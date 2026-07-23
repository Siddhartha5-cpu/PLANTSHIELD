import os
import sys
import logging

logger = logging.getLogger("advisory-service")

# Programmatically append the sibling 'gemini-advisory' directory to sys.path to reuse prompt/LLM logic
PARENT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
GEMINI_ADVISORY_PATH = os.path.abspath(os.path.join(PARENT_DIR, "..", "gemini-advisory"))

if GEMINI_ADVISORY_PATH not in sys.path:
    sys.path.append(GEMINI_ADVISORY_PATH)

try:
    import gemini_advisory
    logger.info("Successfully linked and imported sibling Module 4: 'gemini-advisory'")
except ImportError as err:
    logger.error(
        f"Orchestration Error: Sibling 'gemini-advisory' module could not be resolved at {GEMINI_ADVISORY_PATH}. "
        f"Details: {str(err)}"
    )

def generate_agronomic_advisory(
    disease_label: str,
    confidence: float,
    temperature: float,
    humidity: float,
    soil_moisture: float,
    risk_score: float,
    risk_level: str,
    risk_reasons: list
) -> dict:
    """
    Invokes the Google Gemini Advisory module (Module 4) to formulate a detailed 
    agronomic recommendation, falling back gracefully to static templates if required.
    """
    logger.info(f"Generating agronomic advisory for {disease_label}...")
    try:
        report = gemini_advisory.generate_advisory(
            disease_label=disease_label,
            confidence=confidence,
            temperature=temperature,
            humidity=humidity,
            soil_moisture=soil_moisture,
            risk_score=risk_score,
            risk_level=risk_level,
            risk_reasons=risk_reasons
        )
        return report
    except Exception as e:
        logger.error(f"Failed to generate advisory via gemini-advisory module: {str(e)}")
        return {
            "disease": disease_label,
            "risk_level": risk_level,
            "advisory_markdown": "### 🌾 Crop Condition Summary\nAdvisory generation failed. Please consult a specialist.",
            "metadata": {"mode": "error_fallback"}
        }
