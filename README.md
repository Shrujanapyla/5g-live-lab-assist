# 5G Live Lab Assist

A real-time remote laboratory collaboration platform that connects students and professors through live video streaming, interactive annotations, and a shared workspace.

## About the Project

5G Live Lab Assist aims to make remote laboratory sessions more interactive and accessible. Students can share their live laboratory setup using a camera, while professors can observe the experiment, provide visual guidance, and capture important regions.

## Key Features

- **Session Management:** Professors create sessions and students join using a unique session code.
- **Live Video Streaming:** Students share their camera feed with professors.
- **Real-Time Annotations:** Professors draw on the live video to guide students.
- **Region of Interest (ROI):** Select and crop specific regions from the video.
- **Snapshot Capture:** Capture important experiment details.
- **Snapshot Workspace:** View captured snapshots during a laboratory session.

## Technology Stack

**Frontend**
- React.js
- Vite
- CSS
- Socket.IO Client
- WebRTC

**Backend**
- Node.js
- Express.js
- Socket.IO

## Project Structure

```text
5g-live-lab-assist/
├── client/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   └── index.css
│   └── package.json
├── server/
│   ├── index.js
│   └── package.json
├── .gitignore
└── README.md
```

## How It Works

1. The professor creates a laboratory session.
2. The student joins using the session code.
3. The student shares their live camera feed.
4. The professor views the live laboratory setup.
5. The professor uses annotations to provide guidance.
6. Specific regions can be selected and captured as snapshots.

## Getting Started

### Prerequisites

- Node.js and npm
- A modern web browser
- A webcam or smartphone camera

### 1. Clone the Repository

```bash
git clone https://github.com/Shrujanapyla/5g-live-lab-assist.git
cd 5g-live-lab-assist
```

### 2. Start the Backend

Open a terminal:

```bash
cd server
npm install
npm run dev
```

The backend runs on port `3000`.

### 3. Start the Frontend

Open a second terminal from the project root:

```bash
cd client
npm install
npm run dev
```

Open the Vite development URL, usually:

`http://localhost:5173`

## Current Development Status

- [x] Session creation and joining
- [x] Unique session codes
- [x] Live video communication
- [x] Real-time annotations
- [x] ROI selection and cropping
- [x] Snapshot capture
- [x] Basic snapshot workspace

## Future Enhancements

- Persistent snapshot storage
- Workspace synchronization between participants
- Multiple independently manageable ROI panels
- Edge-server deployment
- Performance evaluation, including video latency, annotation delay, FPS, and dropped frames
- Edge deployment versus cloud deployment comparison

## Project Goal

The long-term goal is to build a collaborative remote laboratory platform that uses edge computing and real-time communication to improve remote practical learning.

---

**Repository:** https://github.com/Shrujanapyla/5g-live-lab-assist