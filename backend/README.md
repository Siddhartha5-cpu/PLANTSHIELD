# PlantShield AI: Orchestration Backend

This directory contains the central **FastAPI Orchestration Layer** for the **PlantShield AI** system. Running on port `5000`, this backend acts as the single endpoint gateway for the React dashboard. 

It receives leaf photos and device identifiers, queries all microservices and databases, runs risk evaluations, compiles LLM agronomic advisories, saves logs, and returns a unified JSON payload.

---

## 1. Directory Structure

```text
backend/
├── clients/
│   ├── inference_client.py   # HTTP client communicating with FastAPI AI (port 8000)
│   └── sensor_client.py      # Boto3 client reading telemetry from AWS DynamoDB
├── services/
│   ├── advisory_service.py   # Aggregates prompt contexts and calls Gemini API (Module 4)
│   ├── risk_service.py       # Calls the rule-based calculation engine (Module 3)
│   └── history_service.py    # Manages local JSON history file database (history_db.json)
├── history_db.json           # Created automatically. Stores trace logs of diagnoses
├── schemas.py                # Pydantic schemas validating API requests/responses
├── main.py                   # REST Router exposing endpoints and CORS middlewares
├── requirements.txt          # Python package dependency configurations
└── README.md                 # This instruction manual
```

---

## 2. API Reference & Swagger Docs

Once running, you can explore the interactive API definitions by opening **`http://127.0.0.1:5000/docs`** in your web browser.

### **GET `/health`**
Returns server status check.

### **GET `/history`**
Returns the list of all historical crop diagnostic runs.
*   **Response:**
    ```json
    [
      {
        "id": "run-a1b2c3d4",
        "timestamp": "2026-07-14T12:00:00Z",
        "deviceId": "ESP32-001",
        "disease": "brown_spot",
        "confidence": 0.94,
        "variety": "IR20",
        "estimatedAge": 45.2,
        "riskScore": 68.5,
        "riskLevel": "High"
      }
    ]
    ```

### **GET `/latest-sensor/{deviceId}`**
Directly reads the latest humidity, temperature, and moisture levels recorded by a specific sensor gateway.

### **POST `/analyze`**
Orchestrates the entire plant assessment pipeline.
*   **Content-Type:** `multipart/form-data`
*   **Form Parameters:**
    *   `file`: Leaf image binary (JPEG/PNG)
    *   `deviceId`: String ID mapping the field zone (e.g. `ESP32-001`)
*   **Response:** Unified JSON payload containing:
    *   `disease`: Predicted class and confidence from Local AI.
    *   `telemetry`: Air temperature, humidity, and soil moisture from AWS.
    *   `riskScore` & `riskLevel`: Health indicators computed by Risk Engine.
    *   `advisory`: Agromony report written by Gemini.

---

## 3. Setup Instructions

### Step 1: Create Virtual Environment & Install Packages
```bash
# Create and activate environment
python -m venv venv
# On Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# On Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Step 2: Configure Environment Variables
1.  Copy `.env.example` to `.env`:
    ```bash
    cp .env.example .env
    ```
2.  Open `.env` and fill in your keys:
    *   `GEMINI_API_KEY`: Google AI Studio API Key (or leave as placeholder to run in fallback mode).
    *   `AWS_ACCESS_KEY_ID` & `AWS_SECRET_ACCESS_KEY`: AWS User keys to connect live to your DynamoDB table. If omitted, the client runs in **local mock fallback** mode automatically.

---

## 4. Running the Server

Start the orchestration server on port `5000`:

```bash
uvicorn main:app --host 127.0.0.1 --port 5000 --reload
```

---

## 5. Manual Testing

You can test the server from your command line:

### Test Health Endpoint:
```bash
curl http://localhost:5000/health
```

### Run Analyze Pipeline:
Use an image file (e.g. `leaf.jpg`) to perform a full mock or live diagnosis:
```bash
curl -X POST "http://localhost:5000/analyze" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@leaf.jpg" \
  -F "deviceId=ESP32-001"
```
