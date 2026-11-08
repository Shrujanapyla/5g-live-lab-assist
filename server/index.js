const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const { randomInt, randomUUID } = require("crypto");

const app = express();

const PORT = Number(process.env.PORT) || 3000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";

app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json({ limit: "10mb" }));

const server = http.createServer(app);

const io = new Server(server, {
  maxHttpBufferSize: 10 * 1024 * 1024,
  cors: {
    origin: CLIENT_ORIGIN,
    methods: ["GET", "POST"]
  }
});

// Store session data in memory.
const sessions = new Map();

const MAX_HISTORY = 500;

function addHistory(session, action, snapshot, userId) {
  session.historySequence += 1;

  const entry = {
    historyId: randomUUID(),
    sequence: session.historySequence,
    action,
    snapshotId: snapshot.id,
    snapshot: structuredClone(snapshot),
    userId,
    timestamp: new Date().toISOString()
  };

  session.snapshotHistory.push(entry);

  if (session.snapshotHistory.length > MAX_HISTORY) {
    session.snapshotHistory.shift();
  }

  return entry;
}

function getJoinedSession(socket) {
  const code = socket.data.sessionCode;

  if (!code) return null;

  const session = sessions.get(code);

  if (!session || !session.participants.has(socket.id)) {
    return null;
  }

  return session;
}

function sendSnapshotError(socket, message) {
  socket.emit("snapshot:error", { message });
}

function isValidObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

// Health check.
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    message: "5G Live Lab Assist backend is running"
  });
});

// Create a session.
app.post("/api/sessions", (req, res) => {
  let code;

  do {
    code = randomInt(0, 36 ** 6)
      .toString(36)
      .toUpperCase()
      .padStart(6, "0");
  } while (sessions.has(code));

  sessions.set(code, {
    code,
    createdAt: new Date().toISOString(),
    participants: new Map(),
    snapshots: new Map(),
    snapshotHistory: [],
    historySequence: 0
  });

  res.status(201).json({
    success: true,
    session: { code }
  });
});

// Validate a session code.
app.post("/api/sessions/join", (req, res) => {
  const code = String(req.body.code || "").trim().toUpperCase();
  const session = sessions.get(code);

  if (!session) {
    return res.status(404).json({
      success: false,
      message: "Session not found. Check the code and try again."
    });
  }

  res.json({
    success: true,
    session: { code: session.code }
  });
});

// Retrieve current snapshots.
app.get("/api/sessions/:code/snapshots", (req, res) => {
  const code = String(req.params.code).trim().toUpperCase();
  const session = sessions.get(code);

  if (!session) {
    return res.status(404).json({
      success: false,
      message: "Session not found."
    });
  }

  res.json({
    success: true,
    snapshots: [...session.snapshots.values()]
  });
});

// Retrieve snapshot history.
app.get("/api/sessions/:code/snapshots/history", (req, res) => {
  const code = String(req.params.code).trim().toUpperCase();
  const session = sessions.get(code);

  if (!session) {
    return res.status(404).json({
      success: false,
      message: "Session not found."
    });
  }

  const requestedLimit = Number.parseInt(req.query.limit, 10);
  const limit = Number.isInteger(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), MAX_HISTORY)
    : 100;

  res.json({
    success: true,
    history: session.snapshotHistory.slice(-limit)
  });
});

// Socket.IO connection.
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // Join a session.
  socket.on("join-session", ({ code, role } = {}) => {
    code = String(code || "").trim().toUpperCase();

    if (!["professor", "student"].includes(role)) {
      socket.emit("session-error", {
        message: "Choose a valid participant role."
      });
      return;
    }

    const session = sessions.get(code);

    if (!session) {
      socket.emit("session-error", {
        message: "Session not found. Create a session first."
      });
      return;
    }

    const previousCode = socket.data.sessionCode;

    // Prevent duplicate professor connections.
    if (role === "professor") {
      const professorAlreadyPresent = [...session.participants.entries()]
        .some(([id, participant]) =>
          id !== socket.id && participant.role === "professor"
        );

      if (professorAlreadyPresent) {
        socket.emit("session-error", {
          message: "A professor is already in this session."
        });
        return;
      }
    }

    // Leave the previous session when switching rooms.
    if (previousCode && previousCode !== code) {
      const previousSession = sessions.get(previousCode);

      if (previousSession) {
        previousSession.participants.delete(socket.id);
      }

      socket.to(previousCode).emit("participant-left", {
        socketId: socket.id
      });

      socket.leave(previousCode);
    }

    const existingParticipants = [...session.participants.entries()]
      .filter(([id]) => id !== socket.id)
      .map(([id, participant]) => ({
        socketId: id,
        role: participant.role
      }));

    session.participants.set(socket.id, { role });

    socket.data.sessionCode = code;
    socket.data.role = role;

    socket.join(code);

    // Send the latest canonical snapshot state to the joining participant.
    socket.emit("session-joined", {
      code,
      role,
      participants: existingParticipants,
      snapshots: [...session.snapshots.values()]
    });

    socket.to(code).emit("participant-joined", {
      socketId: socket.id,
      role
    });

    console.log(`${role} joined session ${code}`);
  });

  // Create a snapshot.
  socket.on("snapshot:create", ({ data, metadata = {} } = {}) => {
    const session = getJoinedSession(socket);

    if (!session) {
      return sendSnapshotError(socket, "Join a session first.");
    }

    if (socket.data.role !== "professor") {
      return sendSnapshotError(socket, "Only the professor can create shared snapshots.");
    }

    if (!isValidObject(data) || !isValidObject(metadata)) {
      return sendSnapshotError(socket, "Invalid snapshot data or metadata.");
    }

    const now = new Date().toISOString();

    const snapshot = {
      id: randomUUID(),
      sessionCode: session.code,
      data: structuredClone(data),
      metadata: structuredClone(metadata),
      createdAt: now,
      updatedAt: now,
      createdBy: socket.id,
      updatedBy: socket.id,
      version: 1
    };

    session.snapshots.set(snapshot.id, snapshot);

    const historyEntry = addHistory(
      session,
      "created",
      snapshot,
      socket.id
    );

    io.to(session.code).emit("snapshot:created", {
      snapshot,
      historyEntry
    });
  });

  // Update an existing snapshot.
  socket.on(
    "snapshot:update",
    ({ snapshotId, data, metadata, expectedVersion } = {}) => {
      const session = getJoinedSession(socket);

      if (!session) {
        return sendSnapshotError(socket, "Join a session first.");
      }

      if (socket.data.role !== "professor") {
        return sendSnapshotError(socket, "Only the professor can update shared snapshots.");
      }

      const snapshot = session.snapshots.get(snapshotId);

      if (!snapshot) {
        return sendSnapshotError(socket, "Snapshot not found.");
      }

      if (expectedVersion !== undefined &&
          expectedVersion !== snapshot.version) {
        socket.emit("snapshot:conflict", {
          message: "Snapshot was changed by another participant.",
          currentSnapshot: structuredClone(snapshot)
        });
        return;
      }

      if (data !== undefined && !isValidObject(data)) {
        return sendSnapshotError(socket, "Invalid snapshot data.");
      }

      if (metadata !== undefined && !isValidObject(metadata)) {
        return sendSnapshotError(socket, "Invalid snapshot metadata.");
      }

      if (data !== undefined) {
        snapshot.data = structuredClone(data);
      }

      if (metadata !== undefined) {
        snapshot.metadata = structuredClone(metadata);
      }

      snapshot.updatedAt = new Date().toISOString();
      snapshot.updatedBy = socket.id;
      snapshot.version += 1;

      const historyEntry = addHistory(
        session,
        "updated",
        snapshot,
        socket.id
      );

      io.to(session.code).emit("snapshot:updated", {
        snapshot,
        historyEntry
      });
    }
  );

  // Delete a snapshot.
  socket.on("snapshot:delete", ({ snapshotId } = {}) => {
    const session = getJoinedSession(socket);

    if (!session) {
      return sendSnapshotError(socket, "Join a session first.");
    }

    const snapshot = session.snapshots.get(snapshotId);

    if (!snapshot) {
      return sendSnapshotError(socket, "Snapshot not found.");
    }

    const historyEntry = addHistory(
      session,
      "deleted",
      snapshot,
      socket.id
    );

    session.snapshots.delete(snapshotId);

    io.to(session.code).emit("snapshot:deleted", {
      snapshotId,
      historyEntry
    });
  });

  // Request snapshot history through Socket.IO.
  socket.on("snapshot:history:request", () => {
    const session = getJoinedSession(socket);

    if (!session) {
      return sendSnapshotError(socket, "Join a session first.");
    }

    socket.emit("snapshot:history", {
      history: session.snapshotHistory
    });
  });

  // Restore a previous snapshot version from history.
  socket.on("snapshot:restore", ({ historyId } = {}) => {
    const session = getJoinedSession(socket);

    if (!session) {
      return sendSnapshotError(socket, "Join a session first.");
    }

    const historyEntry = session.snapshotHistory.find(
      (entry) => entry.historyId === historyId
    );

    if (!historyEntry) {
      return sendSnapshotError(socket, "Snapshot history entry not found.");
    }

    const previousSnapshot = historyEntry.snapshot;

    const restoredSnapshot = {
      ...structuredClone(previousSnapshot),
      updatedAt: new Date().toISOString(),
      updatedBy: socket.id,
      version: (session.snapshots.get(previousSnapshot.id)?.version || 0) + 1
    };

    session.snapshots.set(restoredSnapshot.id, restoredSnapshot);

    const newHistoryEntry = addHistory(
      session,
      "restored",
      restoredSnapshot,
      socket.id
    );

    io.to(session.code).emit("snapshot:updated", {
      snapshot: restoredSnapshot,
      historyEntry: newHistoryEntry
    });
  });

  // WebRTC signaling.
  socket.on("webrtc-offer", ({ offer } = {}) => {
    const code = socket.data.sessionCode;

    if (code && offer && getJoinedSession(socket)) {
      socket.to(code).emit("webrtc-offer", {
        offer,
        from: socket.id
      });
    }
  });

  socket.on("webrtc-answer", ({ answer } = {}) => {
    const code = socket.data.sessionCode;

    if (code && answer && getJoinedSession(socket)) {
      socket.to(code).emit("webrtc-answer", {
        answer,
        from: socket.id
      });
    }
  });

  socket.on("webrtc-ice-candidate", ({ candidate } = {}) => {
    const code = socket.data.sessionCode;

    if (code && candidate && getJoinedSession(socket)) {
      socket.to(code).emit("webrtc-ice-candidate", {
        candidate,
        from: socket.id
      });
    }
  });

  // Relay drawing annotations.
  socket.on("annotation-update", ({ annotation } = {}) => {
    const code = socket.data.sessionCode;

    if (!code || !annotation || !getJoinedSession(socket)) return;

    socket.to(code).emit("annotation-update", {
      annotation,
      from: socket.id
    });
  });

  // Clear annotations.
  socket.on("annotation-clear", () => {
    const code = socket.data.sessionCode;

    if (!code || !getJoinedSession(socket)) return;

    socket.to(code).emit("annotation-clear", {
      from: socket.id
    });
  });

  // Handle participant disconnection.
  socket.on("disconnect", () => {
    const code = socket.data.sessionCode;
    const session = code ? sessions.get(code) : null;

    if (session) {
      session.participants.delete(socket.id);

      socket.to(code).emit("participant-left", {
        socketId: socket.id
      });
    }

    console.log("Client disconnected:", socket.id);
  });
});

// Start server.
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Backend running on port ${PORT}`);
});