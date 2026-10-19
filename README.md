# 🌱 PlantShield AI: Intelligent Crop Health & Advisory System

PlantShield AI integrates visual leaf disease diagnostics (PyTorch ConvNeXt + Google Gemini Vision), real-time ambient IoT telemetry (AWS IoT Core & DynamoDB), and dynamic agronomic advisory generation (Gemini AI).

---

## 💻 Prerequisites for New Machine

Before running on a new computer or laptop, ensure the following are installed:
1. **Python 3.10+** (Ensure **"Add python.exe to PATH"** was checked during installation).
2. **Node.js 18+ & npm** (Check with `node -v` and `npm -v`).
3. **Git** (Check with `git --version`).

---

## 🚀 Quick Setup (Automated)

### Step 1: Clone or Copy the Repository
```bash
git clone https://github.com/Siddhartha5-cpu/PLANTSHIELD.git
cd PLANTSHIELD
```

### Step 2: Configure Environment Variables
Copy the template to create your `.env` file in the `backend/` directory:
```bash
cp backend/.env.example backend/.env
```
Open `backend/.env` in Notepad or your editor and make sure your credentials are filled in:
```env
PORT=5000
FASTAPI_AI_URL=http://127.0.0.1:8000
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
AWS_REGION=ap-south-1
DYNAMODB_TABLE_LATEST=PlantShieldLatestState
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
```

### Step 3: Run the Automated Setup Script
Double-click `setup.bat` (or run it from your command prompt):
```cmd
setup.bat
```
This script will:
* Create Python virtual environments in `ai-service/venv` and `backend/venv`
* Install PyTorch, torchvision, timm, FastAPI, and other dependencies
* Install frontend Node dependencies via `npm install`

---

## ⚡ Starting the Project

### Option A: 1-Click Launch (Recommended)
Double-click `start_services.bat` in the root directory.

This automatically launches all three required services in dedicated terminal windows:
1. **AI Model Service:** `http://127.0.0.1:8000`
2. **Backend Orchestrator:** `http://127.0.0.1:5000`
3. **Frontend Dashboard:** `http://localhost:5173`

---

### Option B: Manual Launch (3 Terminal Windows)

#### Terminal 1 — AI Inference Engine (Port 8000)
```bash
cd ai-service
call venv\Scripts\activate
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

#### Terminal 2 — Backend Orchestrator (Port 5000)
```bash
cd backend
call venv\Scripts\activate
uvicorn main:app --host 127.0.0.1 --port 5000 --reload
```

#### Terminal 3 — Frontend Dashboard (Port 5173)
```bash
cd frontend
npm run dev
```

Then visit **`http://localhost:5173`** in your browser.
