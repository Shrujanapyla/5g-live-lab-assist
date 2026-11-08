const { io } = require("socket.io-client");

const BASE_URL = "http://localhost:3000";

function waitFor(socket, event) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timeout waiting for ${event}`)),
      5000
    );

    socket.once(event, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

async function main() {
  let professor;
  let student;

  try {
    // Create a session.
    const response = await fetch(`${BASE_URL}/api/sessions`, {
      method: "POST"
    });

    const result = await response.json();
    const code = result.session.code;

    console.log("Session created:", code);

    // Connect professor and student.
    professor = io(BASE_URL);
    student = io(BASE_URL);

    await Promise.all([
      waitFor(professor, "connect"),
      waitFor(student, "connect")
    ]);

    console.log("Both clients connected.");

    // Join both participants to the session.
    const professorJoined = waitFor(professor, "session-joined");
    const studentJoined = waitFor(student, "session-joined");

    professor.emit("join-session", {
      code,
      role: "professor"
    });

    student.emit("join-session", {
      code,
      role: "student"
    });

    await Promise.all([professorJoined, studentJoined]);

    console.log("Professor and student joined.");

    // Test snapshot creation.
    const created = waitFor(student, "snapshot:created");

    professor.emit("snapshot:create", {
      data: {
        title: "Test Snapshot",
        content: "Shared classroom workspace"
      },
      metadata: {
        description: "First synchronization test"
      }
    });

    const createdData = await created;
    const snapshotId = createdData.snapshot.id;

    console.log("PASS: Student received created snapshot.");

    // Test snapshot update.
    const updated = waitFor(student, "snapshot:updated");

    professor.emit("snapshot:update", {
      snapshotId,
      data: {
        title: "Updated Snapshot",
        content: "Updated shared workspace"
      },
      expectedVersion: 1
    });

    const updatedData = await updated;

    console.log(
      "PASS: Student received update. Version:",
      updatedData.snapshot.version
    );

    // Test shared ROI drawing annotations.
    const annotationUpdate = waitFor(student, "snapshot:updated");
    professor.emit("snapshot:update", {
      snapshotId,
      data: {
        title: "Updated Snapshot",
        content: "Updated shared workspace",
        image: "data:image/png;base64,dGVzdA==",
        annotations: [
          {
            from: { x: 0.1, y: 0.2 },
            to: { x: 0.8, y: 0.7 },
            color: "#ff3333"
          }
        ]
      },
      expectedVersion: 2
    });
    const annotationData = await annotationUpdate;
    if (annotationData.snapshot.data.annotations?.length !== 1) {
      throw new Error("Snapshot drawing annotation was not synchronized.");
    }
    console.log("PASS: ROI drawing annotation synchronized.");

    // Test history retrieval.
    const historyReceived = waitFor(professor, "snapshot:history");

    professor.emit("snapshot:history:request");

    const history = await historyReceived;

    console.log(
      "PASS: History retrieved. Entries:",
      history.history.length
    );

    // Restore the original version and verify a new version is broadcast.
    const originalEntry = history.history.find(
      (entry) => entry.action === "created"
    );
    if (!originalEntry) throw new Error("Original history entry was not found.");

    const restoredUpdate = waitFor(student, "snapshot:updated");
    professor.emit("snapshot:restore", {
      historyId: originalEntry.historyId
    });

    const restoredUpdateData = await restoredUpdate;
    if (restoredUpdateData.snapshot.data.title !== "Test Snapshot") {
      throw new Error("Restore did not recover the original snapshot data.");
    }
    if (restoredUpdateData.snapshot.version !== 4) {
      throw new Error("Restored snapshot version should be 4.");
    }

    console.log("PASS: Previous version restored and broadcast.");

    // Test reconnection and state restoration.
    student.disconnect();

    const reconnectedStudent = io(BASE_URL);
    student = reconnectedStudent;

    await waitFor(student, "connect");

    const restoredState = waitFor(student, "session-joined");

    student.emit("join-session", {
      code,
      role: "student"
    });

    const restored = await restoredState;

    console.log(
      "PASS: Reconnected student received snapshots:",
      restored.snapshots.length
    );

    // Test snapshot deletion.
    const deleted = waitFor(student, "snapshot:deleted");

    professor.emit("snapshot:delete", {
      snapshotId
    });

    await deleted;

    console.log("PASS: Student received snapshot deletion.");

    // Verify final snapshot state through REST API.
    const finalResponse = await fetch(
      `${BASE_URL}/api/sessions/${code}/snapshots`
    );

    const finalResult = await finalResponse.json();

    console.log(
      "PASS: Remaining snapshots:",
      finalResult.snapshots.length
    );

    console.log("\nALL SNAPSHOT TESTS COMPLETED SUCCESSFULLY.");

  } catch (error) {
    console.error("\nTEST FAILED:", error.message);
    process.exitCode = 1;

  } finally {
    if (professor) professor.disconnect();
    if (student) student.disconnect();
  }
}

main();