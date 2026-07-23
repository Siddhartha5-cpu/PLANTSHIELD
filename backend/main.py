import os
import time
import logging
from typing import List
from fastapi import FastAPI, File, UploadFile, Form, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Load env configurations explicitly from backend folder
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
load_dotenv(dotenv_path=env_path, override=True)

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("orchestrator")

# Import Clients & Services
from clients.inference_client import predict_leaf_image, AIServiceConnectionError
from clients.sensor_client import fetch_latest_sensors
from services.risk_service import evaluate_crop_risk
from services.advisory_service import generate_agronomic_advisory
from services.history_service import load_history, save_analysis_record
from schemas import AnalysisReport, HistoryLogItem

app = FastAPI(
    title="PlantShield AI Orchestration Backend",
    description="Orchestrator microservice bridging local PyTorch AI, AWS DynamoDB, and Gemini advisory.",
    version="1.0.0"
)

# Enable CORS (Cross-Origin Resource Sharing)
# Critical to allow the React dashboard running on port 3000 to query port 5000.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this to your dashboard domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    """Returns the orchestrator health status."""
    return {
        "status": "healthy",
        "timestamp": time.time(),
        "service": "PlantShield AI Orchestrator"
    }

@app.post("/analyze", response_model=AnalysisReport)
async def analyze_crop(
    file: UploadFile = File(...),
    deviceId: str = Form(...)
):
    """
    Orchestrates the complete PlantShield AI diagnostics pipeline:
    1. Uploads and predicts leaf disease via local AI FastAPI.
    2. Queries microclimate sensors via AWS DynamoDB.
    3. Runs rule-based calculations via Risk Engine.
    4. Formulates advisories via Google Gemini API.
    5. Saves diagnosis traces locally to JSON history.
    """
    logger.info(f"Received diagnosis query from dashboard for device: {deviceId}")
    
    # Validate file type
    if not (file.content_type.startswith("image/") or file.filename.lower().endswith(('.png', '.jpg', '.jpeg'))):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file must be a valid leaf image (JPEG/PNG)."
        )
        
    start_time = time.time()
    
    # Step 1: Query Local AI Inference Service
    try:
        image_bytes = await file.read()
        ai_response = await predict_leaf_image(image_bytes, file.filename)
    except AIServiceConnectionError as conn_err:
        logger.error(f"Inference gateway error: {str(conn_err)}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(conn_err)
        )
    except Exception as e:
        logger.error(f"Failed during visual inference stage: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Inference stage failed: {str(e)}"
        )

    # Step 2: Query AWS Telemetry Data source (DynamoDB or mock fallback)
    try:
        telemetry_data = fetch_latest_sensors(deviceId)
    except Exception as e:
        logger.error(f"Failed to query sensors telemetry: {str(e)}")
        # Ultimate fallback to generic metrics to avoid breaking pipeline
        telemetry_data = {"temperature": 27.0, "humidity": 65.0, "soilMoisture": 50.0}

    # Step 3: Run the Risk Engine logic
    try:
        # Check if humidity is rising based on recent reports (optional check, defaulting here to None)
        risk_report = evaluate_crop_risk(
            disease_label=ai_response["disease"]["class_name"],
            confidence=ai_response["disease"]["confidence"],
            temperature=telemetry_data["temperature"],
            humidity=telemetry_data["humidity"],
            soil_moisture=telemetry_data["soilMoisture"]
        )
    except Exception as e:
        logger.error(f"Failed to compute risk score: {str(e)}")
        risk_report = {"risk_score": 50.0, "risk_level": "Medium", "risk_reasons": ["Risk calculations errored out."]}

    # Step 4: Query Google Gemini Advisory (latest SDK or templates)
    try:
        advisory_report = generate_agronomic_advisory(
            disease_label=ai_response["disease"]["class_name"],
            confidence=ai_response["disease"]["confidence"],
            temperature=telemetry_data["temperature"],
            humidity=telemetry_data["humidity"],
            soil_moisture=telemetry_data["soilMoisture"],
            risk_score=risk_report["risk_score"],
            risk_level=risk_report["risk_level"],
            risk_reasons=risk_report["risk_reasons"]
        )
    except Exception as e:
        logger.error(f"Failed to compile agronomic advisory: {str(e)}")
        advisory_report = {"advisory_markdown": "### 🌾 Crop Condition Summary\nAdvisory calculation failed.", "metadata": {"mode": "error"}}

    timestamp_iso = ai_response.get("timestamp", time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))

    # Step 5: Log diagnostic run to history database
    try:
        save_analysis_record(
            device_id=deviceId,
            timestamp=timestamp_iso,
            disease_label=ai_response["disease"]["class_name"],
            confidence=ai_response["disease"]["confidence"],
            variety=ai_response["variety"]["class_name"],
            estimated_age=ai_response["estimated_age_days"],
            risk_score=risk_report["risk_score"],
            risk_level=risk_report["risk_level"]
        )
    except Exception as e:
        logger.error(f"Failed to log record to local database: {str(e)}")

    elapsed_time_ms = (time.time() - start_time) * 1000

    # Step 6: Return unified response
    return {
        "timestamp": timestamp_iso,
        "deviceId": deviceId,
        "disease": {
            "class_id": ai_response["disease"]["class_id"],
            "class_name": ai_response["disease"]["class_name"],
            "confidence": ai_response["disease"]["confidence"]
        },
        "top3_diseases": [
            {
                "class_id": item["class_id"],
                "class_name": item["class_name"],
                "confidence": item["confidence"]
            } for item in ai_response.get("top3_diseases", [ai_response["disease"]])
        ],
        "variety": ai_response["variety"]["class_name"],
        "estimatedAge": ai_response["estimated_age_days"],
        "telemetry": telemetry_data,
        "riskScore": risk_report["risk_score"],
        "riskLevel": risk_report["risk_level"],
        "riskReasons": risk_report["risk_reasons"],
        "advisory": advisory_report["advisory_markdown"],
        "metadata": {
            "inference_time_ms": round(elapsed_time_ms, 2),
            "ai_service_device": ai_response.get("metadata", {}).get("device", "cpu"),
            "advisory_mode": advisory_report["metadata"]["mode"]
        }
    }

@app.get("/latest-sensor/{deviceId}")
async def get_latest_sensor(deviceId: str):
    """Retrieves the latest sensor reading for a specific device."""
    try:
        return fetch_latest_sensors(deviceId)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve telemetry: {str(e)}"
        )

@app.get("/history", response_model=List[HistoryLogItem])
async def get_history_logs():
    """Retrieves all previous diagnosis logs from the history database."""
    return load_history()

if __name__ == "__main__":
    import uvicorn
    # Start on port 5000 by default to match dashboard target config
    port = int(os.getenv("PORT", 5000))
    uvicorn.run("main:app", host="127.0.0.1", port=port, reload=True)
