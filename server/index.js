
const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const { randomInt } = require("crypto");

const app = express();

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

// Sessions are stored in memory for this prototype.
const sessions = new Map();

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
    participants: new Map()
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

// Join a real-time Socket.IO room.
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

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

    // Allow only one professor in a session at a time.
    if (role === "professor") {
      const professorAlreadyPresent = [...session.participants.values()]
        .some((participant) => participant.role === "professor");

      if (
        professorAlreadyPresent &&
        session.participants.get(socket.id)?.role !== "professor"
      ) {
        socket.emit("session-error", {
          message: "A professor is already in this session."
        });
        return;
      }
    }

    // Leave the previous room if this socket changes sessions.
    const previousCode = socket.data.sessionCode;

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

    socket.emit("session-joined", {
      code,
      role,
      participants: existingParticipants
    });

    socket.to(code).emit("participant-joined", {
      socketId: socket.id,
      role
    });

    console.log(`${role} joined session ${code}`);
  });
  
  // WebRTC signaling: send call setup messages to the other participant.
  socket.on("webrtc-offer", ({ offer } = {}) => {
    const code = socket.data.sessionCode;
    if (code && offer) {
      socket.to(code).emit("webrtc-offer", {
        offer,
        from: socket.id
      });
    }
  });

  socket.on("webrtc-answer", ({ answer } = {}) => {
    const code = socket.data.sessionCode;
    if (code && answer) {
      socket.to(code).emit("webrtc-answer", {
        answer,
        from: socket.id
      });
    }
  });

  socket.on("webrtc-ice-candidate", ({ candidate } = {}) => {
    const code = socket.data.sessionCode;
    if (code && candidate) {
      socket.to(code).emit("webrtc-ice-candidate", {
        candidate,
        from: socket.id
      });
    }
  });
  
  // Relay drawing annotations to the other participant in the session.
  socket.on("annotation-update", ({ annotation } = {}) => {
    const code = socket.data.sessionCode;

    if (!code || !annotation) return;

    socket.to(code).emit("annotation-update", {
      annotation,
      from: socket.id
    });
  });

  // Clear annotations for both participants.
  socket.on("annotation-clear", () => {
    const code = socket.data.sessionCode;

    if (!code) return;

    socket.to(code).emit("annotation-clear", {
      from: socket.id
    });
  });

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

server.listen(3000, () => {
  console.log("Backend running at http://localhost:3000");
});
