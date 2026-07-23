import os
import json
import logging
from uuid import uuid4

logger = logging.getLogger("history-service")

# Path to the local JSON database file
DB_FILE_PATH = os.path.join(os.path.dirname(__file__), "..", "history_db.json")

# Initial seed data for the history log database so it has mock entries on startup
INITIAL_SEED = [
    {
        "id": "run-101",
        "timestamp": "2026-07-14T12:00:00Z",
        "deviceId": "ESP32-001",
        "disease": "brown_spot",
        "confidence": 0.94,
        "variety": "IR20",
        "estimatedAge": 45.2,
        "riskScore": 68.5,
        "riskLevel": "High"
    },
    {
        "id": "run-102",
        "timestamp": "2026-07-14T11:30:00Z",
        "deviceId": "ESP32-001",
        "disease": "normal",
        "confidence": 0.99,
        "variety": "ADT45",
        "estimatedAge": 22.0,
        "riskScore": 12.0,
        "riskLevel": "Low"
    }
]

def load_history() -> list:
    """Reads all historical diagnosis logs from the local JSON database file."""
    if not os.path.exists(DB_FILE_PATH):
        logger.info(f"Database not found. Seeding initial history logs into '{DB_FILE_PATH}'...")
        try:
            with open(DB_FILE_PATH, "w") as f:
                json.dump(INITIAL_SEED, f, indent=4)
            return INITIAL_SEED
        except Exception as e:
            logger.error(f"Failed to seed history database file: {str(e)}")
            return []
            
    try:
        with open(DB_FILE_PATH, "r") as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Failed to read history database file '{DB_FILE_PATH}': {str(e)}")
        return []

def save_analysis_record(
    device_id: str,
    timestamp: str,
    disease_label: str,
    confidence: float,
    variety: str,
    estimated_age: float,
    risk_score: float,
    risk_level: str
) -> dict:
    """
    Appends a new simplified log record to the history file for frontend list viewing.
    Returns:
        dict: The created log item
    """
    history = load_history()
    
    new_item = {
        "id": f"run-{uuid4().hex[:8]}",
        "timestamp": timestamp,
        "deviceId": device_id,
        "disease": disease_label,
        "confidence": round(confidence, 2),
        "variety": variety,
        "estimatedAge": round(estimated_age, 2),
        "riskScore": round(risk_score, 2),
        "riskLevel": risk_level
    }
    
    # Prepend to show newest first
    history.insert(0, new_item)
    
    try:
        with open(DB_FILE_PATH, "w") as f:
            json.dump(history, f, indent=4)
        logger.info(f"Saved new diagnostic run '{new_item['id']}' to database history.")
        return new_item
    except Exception as e:
        logger.error(f"Failed to write to history database file: {str(e)}")
        return new_item
