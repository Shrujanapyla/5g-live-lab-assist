# 5G Live Lab Assist

A real-time remote laboratory collaboration platform that connects students and professors through live video streaming, interactive annotations, and a shared workspace.

## About the Project

5G Live Lab Assist aims to make remote laboratory sessions more interactive and accessible. Students can share their live laboratory setup using a camera, while professors can observe experiments, provide visual guidance, and capture important regions.

## Project Demo

![5G Live Lab Assist Demo](screenshots/roi-snapshot.png)

## Key Features

- **Session Management:** Professors create sessions and students join using a unique session code.
- **Live Video Streaming:** Students share their camera feed with professors.
- **Real-Time Annotations:** Professors draw on the live video to guide students.
- **Region of Interest (ROI):** Select and crop specific regions from the video.
- **Snapshot Capture:** Capture important experiment details.
- **Multi-ROI Workspace:** Open multiple captured regions in independent draggable and resizable panels.
- **Independent Inspection:** Zoom and pan each ROI separately, add notes, and switch between snapshot versions.
- **Shared Snapshot History:** Snapshot creation, updates, deletion, and restoration are synchronized between participants.

## Project Screenshots

### 1. Professor Dashboard
![Professor Dashboard](screenshots/professor-dashboard.png)

### 2. Student Dashboard
![Student Dashboard](screenshots/student-dashboard.png)

### 3. Live Video Streaming
![Live Video Streaming](screenshots/live-video-streaming.png)

### 4. Real-Time Annotations
![Real-Time Annotations](screenshots/annotations.png)

### 5. ROI Selection and Snapshot Workspace
![ROI Selection and Snapshot Workspace](screenshots/roi-snapshot.png)

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
├── screenshots/
├── .gitignore
└── README.md
```

## System Architecture

The application follows a client-server architecture with WebRTC for real-time video communication and Socket.IO for session management and signaling.

```mermaid
flowchart TD
    A[Student Browser] --> C[React Frontend]
    B[Professor Browser] --> C
    C <--> D[Express and Socket.IO Backend]
    A --> E[WebRTC Peer Connection]
    E --> B
    A --> F[Student Camera]
    F --> E
    B --> G[Annotations]
    G --> C
    B --> H[ROI Selection and Snapshot Workspace]
```

### Main Components

- **Student Client:** Captures the student's camera feed and joins a laboratory session.
- **Professor Client:** Receives live video and provides visual guidance through annotations.
- **React + Vite:** Provides the user interface.
- **Express + Socket.IO:** Handles session management and real-time communication events.
- **WebRTC:** Enables peer-to-peer live video communication.
- **ROI Workspace:** Allows the professor to select, crop, and capture important regions.

### Communication Technologies

| Technology | Responsibility |
|---|---|
| React | Frontend user interface |
| Vite | Frontend development server |
| Express.js | Backend server |
| Socket.IO | Session management and signaling |
| WebRTC | Live video communication |
| Node.js | Backend runtime |

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

The backend listens on port `3000` by default. Optional deployment settings are shown in `server/.env.example`; set `PORT` and `CLIENT_ORIGIN` in the environment when deploying.

### 3. Start the Frontend

Open a second terminal from the project root:

```bash
cd client
npm install
npm run dev
```

Open the Vite development URL, usually:

`http://localhost:5173`

The frontend uses `http://localhost:3000` by default. To point it at an edge backend, create `client/.env` from `client/.env.example` and set `VITE_SERVER_URL` to the backend's reachable URL before building/running Vite.

### Backend integration test

With the backend running in one terminal, run this in another:

```bash
cd server
npm test
```

The test exercises session joining, snapshot creation and update, history retrieval, restoring an older version, reconnecting, and deleting a snapshot.

## Project Workflow

```mermaid
flowchart TD
    A([Start]) --> B[Professor Creates Session]
    B --> C[Unique Session Code Generated]
    C --> D[Student Enters Session Code]
    D --> E[Student Joins Session]
    E --> F[Establish Connection]
    F --> G[Student Shares Camera Feed]
    G --> H[Professor Views Live Video]
    H --> I[Professor Adds Annotations]
    I --> J[Student Receives Visual Guidance]
    J --> K[Professor Selects ROI]
    K --> L[Crop and Capture Snapshot]
    L --> M[Snapshot Appears in Workspace]
    M --> N([Collaboration Continues])
```

### Collaboration Process

1. **Session Creation:** Professor creates a new laboratory session.
2. **Student Joining:** Student enters the unique session code.
3. **Connection:** Both participants establish communication.
4. **Live Observation:** Student shares the camera feed.
5. **Visual Guidance:** Professor draws annotations.
6. **Region Selection:** Professor selects an important region.
7. **Snapshot Capture:** Selected regions are captured and displayed in the workspace.

## Current Development Status

- [x] Session creation and joining
- [x] Unique session codes
- [x] Live video communication
- [x] Real-time annotations
- [x] ROI selection and cropping
- [x] Snapshot capture
- [x] Multiple independently manageable ROI panels
- [x] Per-ROI zoom, pan, notes, and snapshot history
- [x] Real-time workspace synchronization between participants
- [x] Snapshot version restoration and shared deletion
- [x] Backend integration test for create, update, history, restore, reconnect, and delete
- [x] Configurable backend URL, port, and allowed frontend origin for deployment preparation

## Remaining Work Before a Production / 5G Edge Demo

The following items require infrastructure access or further evaluation and are not claimed as completed:

- **Durable storage:** Current sessions and snapshot history are held in server memory and are lost when the backend restarts. Add a database or persistent file store before using this beyond a demo.
- **University edge deployment:** Deploy the Node.js backend on the university edge server, configure `PORT` and `CLIENT_ORIGIN`, and set the frontend `VITE_SERVER_URL` to the edge server address. This repository is still configured for local development by default; deployment has not been performed.
- **Network traversal:** The current WebRTC configuration uses a public STUN server. A TURN server may be required when peers cannot establish a direct connection.
- **Performance evaluation:** Measure connection setup time, video frame rate, end-to-end video delay, annotation delay, snapshot transfer time, and packet loss on both local and 5G/edge networks.
- **Edge versus cloud comparison:** Repeat the same measurements against an edge-hosted backend and a cloud-hosted backend, then compare latency and reliability. The video itself currently uses peer-to-peer WebRTC; Socket.IO carries signaling, annotations, and snapshot/workspace events.
- **Production hardening:** Add authentication/authorization, session expiry, payload limits appropriate to deployment, HTTPS, logging, and operational monitoring.

## Project Goal

The long-term goal is to build a collaborative remote laboratory platform that uses edge computing and real-time communication to improve remote practical learning.

---

**Repository:** [5G Live Lab Assist](https://github.com/Shrujanapyla/5g-live-lab-assist)