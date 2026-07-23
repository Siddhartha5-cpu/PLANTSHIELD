# PlantShield AI: Dashboard Portal UI

This directory contains the **React + Vite** frontend dashboard application for **PlantShield AI**. It features a modern, responsive single-page dashboard with glassmorphism styling, a custom navigation sidebar, live telemetry charts, diagnostic uploader panels, and configuration settings.

---

## 1. Directory Structure

```text
frontend/
├── bin/ (not used)
├── public/                # Static assets (favicons, etc.)
├── src/
│   ├── App.jsx            # Main app router, sidebar, and 8 pages (Overview, etc.)
│   ├── api.js             # API connection and local localStorage mock fallbacks
│   ├── index.css          # Theme styles, custom badges, grids, and glass cards
│   └── main.jsx           # React app mount bootstrap
├── index.html             # Entry HTML document linking Google Fonts
├── vite.config.js         # Vite configuration mapping port 3000
└── README.md              # This instruction manual
```

---

## 2. API Ingress Strategy (Mock vs. Live)

To allow offline validation and out-of-the-box execution, the dashboard is designed with a **smart API Service layer** (`src/api.js`):

*   **Mock Mode (Default):** Generates realistic data arrays representing greenhouse devices, telemetry history logs, drought anomalies, and sample Blast diagnostics.
*   **Live Mode (Fully Configurable):** When you run the local FastAPI service (Module 1) and enter the FastAPI server URL (e.g., `http://127.0.0.1:8000`) in the **Settings Page**:
    1.  The dashboard routes image files directly to the live FastAPI endpoint `/predict-image`.
    2.  It parses PyTorch predictions (classification index, confidence, estimated age, variety).
    3.  It evaluates the risk score locally using client-side JavaScript mirroring your Python Risk Engine rules.
    4.  It displays the diagnostic results dynamically on the UI!

---

## 3. Deployment & Running Locally

### Step 1: Install Node Dependencies
Open your terminal, navigate to the `frontend` folder, and run:

```bash
cd "C:\Users\MEGHARAJU SAIKIRAN\.gemini\antigravity-ide\scratch\plantshield-ai\frontend"
npm install
```

### Step 2: Start the Vite Dev Server
Launch the local server:

```bash
npm run dev
```

The server will start running on: **`http://127.0.0.1:3000`**
*   Open the link in your web browser to interact with the dashboard.

---

## 4. Technical Features

1.  **Custom SVG Line Charts:** By coding raw SVG polyline calculations (`src/App.jsx` -> `TelemetryChart`), the telemetry visualizers scale responsively without needing heavy third-party canvas charts. This guarantees fast performance and avoids cross-platform node compilation crashes during install.
2.  **Modular Glassmorphic Theme:** The interface features a dark slate background, translucent cards (`backdrop-filter`), vibrant green indicators, red danger metrics, and micro-hover transitions defined in `src/index.css`.
3.  **Active Device status card grids:** Monitor active gateways battery percentages and connection signals at a glance.
