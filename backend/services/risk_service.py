import os
import sys
import logging

logger = logging.getLogger("risk-service")

# Programmatically append the sibling 'risk-engine' directory to sys.path to reuse calculation logic
PARENT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
RISK_ENGINE_PATH = os.path.abspath(os.path.join(PARENT_DIR, "..", "risk-engine"))

if RISK_ENGINE_PATH not in sys.path:
    sys.path.append(RISK_ENGINE_PATH)

try:
    import risk_engine
    logger.info("Successfully linked and imported sibling Module 3: 'risk-engine'")
except ImportError as err:
    logger.error(
        f"Orchestration Error: Sibling 'risk-engine' module could not be resolved at {RISK_ENGINE_PATH}. "
        f"Details: {str(err)}"
    )
    # Provide local fallback calculation in case pathing resolution fails in deployment environments
    import mock_risk_calculator as risk_engine  # We define a fallback import variable if needed

def evaluate_crop_risk(
    disease_label: str,
    confidence: float,
    temperature: float,
    humidity: float,
    soil_moisture: float,
    recent_trends: dict = None
) -> dict:
    """
    Invokes the Python Risk Engine (Module 3) to compute the unified risk score, 
    risk level, and retrieve detailed bulleted reasons.
    """
    logger.info(f"Evaluating crop health risk for disease: {disease_label}...")
    try:
        # Call the modular risk calculation engine
        report = risk_engine.calculate_risk(
            disease_label=disease_label,
            disease_confidence=confidence,
            temperature=temperature,
            humidity=humidity,
            soil_moisture=soil_moisture,
            recent_trends=recent_trends
        )
        return report
    except Exception as e:
        logger.error(f"Failed to evaluate risk via risk-engine module: {str(e)}")
        # Simple local fallback recovery
        score = 10.0 if disease_label.lower() == "normal" else 55.0
        return {
            "risk_score": score,
            "risk_level": "Medium" if score >= 25 else "Low",
            "risk_reasons": ["Risk Engine calculation failed. Displaying fallback score."],
            "details": {}
        }
