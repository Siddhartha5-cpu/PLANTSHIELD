import os
import logging
from dotenv import load_dotenv
from google import genai
from prompt_builder import build_advisory_prompt

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("gemini-advisory")

# Load environment configuration from .env file
load_dotenv()

# Initialize API Key and Model configuration
api_key = os.getenv("GEMINI_API_KEY")
model_name = os.getenv("GEMINI_MODEL", "gemini-2.5-flash") # Default to modern 2.5-flash

# Configure modern Google GenAI client if key is available
client = None
is_api_ready = False
if api_key and not api_key.startswith("YOUR_"):
    try:
        # Instantiate GenAI Client (latest SDK)
        client = genai.Client(api_key=api_key)
        is_api_ready = True
        logger.info(f"Gemini API Client configured successfully using model: {model_name}")
    except Exception as e:
        logger.error(f"Failed to configure Gemini Client: {str(e)}")
else:
    logger.warning("Gemini API key is missing or is placeholder. Fallback mode will be used.")

def get_static_fallback_advisory(
    disease_label: str,
    confidence: float,
    temperature: float,
    humidity: float,
    soil_moisture: float,
    risk_level: str
) -> str:
    """
    Returns a structured, pre-written agronomic advisory template based on the 
    detected disease and environment parameters if the Gemini API is unreachable.
    """
    warning_prefix = ""
    if confidence < 0.60:
        warning_prefix = (
            "### ⚠️ UNCERTAIN DIAGNOSIS WARNING\n"
            "The visual model confidence is low. Please physically verify these symptoms "
            "with a crop specialist before buying or applying treatments.\n\n"
        )
        
    disease_key = disease_label.lower().strip()
    
    if disease_key == "normal":
        return warning_prefix + (
            "### 🌾 Crop Condition Summary\n"
            "The rice leaves appear clean, and the visual AI model indicates a healthy crop. "
            "There are currently no active signs of pathogen attacks.\n\n"
            "### ⚠️ Likely Concerns\n"
            "No immediate pathological concerns. Keep monitoring environmental parameters like "
            "extreme heat or dry soil which can stress the plants and make them vulnerable later.\n\n"
            "### 🛠️ Immediate Next Actions\n"
            "* Continue standard irrigation schedules.\n"
            "* Keep clean field borders to prevent pest migration from nearby weeds.\n\n"
            "### 🛡️ Preventive Recommendations\n"
            "* Maintain crop rotation schedules in the next cycle.\n"
            "* Regularly inspect lower stalks where moisture builds up first."
        )
        
    elif disease_key == "blast":
        return warning_prefix + (
            "### 🌾 Crop Condition Summary\n"
            "Symptoms indicate a likely Blast infection (fungal attack). Blast is highly destructive "
            "and causes spindle-shaped lesions on leaves.\n\n"
            "### ⚠️ Likely Concerns\n"
            f"Fungal spores thrive under your current relative humidity ({humidity:.1f}%). High humidity "
            "and moderate temperatures promote fast incubation and spread across neighboring plants.\n\n"
            "### 🛠️ Immediate Next Actions\n"
            "* Drain standing water temporarily to reduce microclimate humidity.\n"
            "* Separate infected crop residues immediately. Avoid moving from infected fields to healthy ones.\n\n"
            "### 🛡️ Preventive Recommendations\n"
            "* Avoid excessive nitrogen fertilizer applications, as high nitrogen makes leaves soft and susceptible.\n"
            "* Use certified disease-resistant seeds for the next planting season."
        )

    elif disease_key == "brown_spot":
        return warning_prefix + (
            "### 🌾 Crop Condition Summary\n"
            "Symptoms indicate possible Brown Spot infection, characterized by small, circular dark brown "
            "spots on the leaf blades. Often associated with nutrient-deficient or stressed soil.\n\n"
            "### ⚠️ Likely Concerns\n"
            f"If soil moisture is low ({soil_moisture:.1f}%), drought stress weakens the plant root system, "
            "substantially reducing the crop's natural resistance to fungal entry.\n\n"
            "### 🛠️ Immediate Next Actions\n"
            "* Apply balanced potassium/potash fertilizers to boost plant structural cell walls.\n"
            "* Ensure the field receives adequate, uniform irrigation to alleviate drought stress.\n\n"
            "### 🛡️ Preventive Recommendations\n"
            "* Perform soil nutrient mapping before the next seedbed preparation.\n"
            "* Correct soil acidity and ensure high organic matter content in seedbeds."
        )

    else:
        # Generic Template fallback for any other disease
        return warning_prefix + (
            f"### 🌾 Crop Condition Summary\n"
            f"Crop leaf symptoms show likely signs of '{disease_label}' disease with an overall "
            f"risk threat level classified as {risk_level}.\n\n"
            f"### ⚠️ Likely Concerns\n"
            f"Under current conditions (Temp: {temperature:.1f}°C, Humidity: {humidity:.1f}%), "
            f"microclimate environment parameters may be accelerating plant stress and favoring pathogen spread.\n\n"
            f"### 🛠️ Immediate Next Actions\n"
            f"* Physically isolate or prune heavily infected leaves to halt spore spread.\n"
            f"* Consult your local agricultural extension service for validation.\n\n"
            f"### 🛡️ Preventive Recommendations\n"
            f"* Practice sanitizing tools after working in the affected fields.\n"
            f"* Ensure appropriate crop spacing to facilitate optimal airflow and wind drying."
        )


def generate_advisory(
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
    Generates agronomic advisory. Tries calling Google Gemini API first; 
    falls back gracefully to static templates if offline or unauthorized.
    """
    prompt = build_advisory_prompt(
        disease_label, confidence, temperature, humidity, 
        soil_moisture, risk_score, risk_level, risk_reasons
    )
    
    advisory_text = ""
    mode_used = "static_fallback"

    if is_api_ready and client:
        try:
            logger.info("Querying Gemini API for agronomic report...")
            # Use modern Client Models Generate Content syntax
            response = client.models.generate_content(
                model=model_name,
                contents=prompt
            )
            
            if response and response.text:
                advisory_text = response.text.strip()
                mode_used = "gemini_api"
                logger.info("Successfully received Gemini advisory content.")
        except Exception as api_err:
            logger.warning(f"Gemini API request failed ({str(api_err)}). Falling back to static templates...")
            
    # Apply static fallback if API failed or was not configured
    if not advisory_text:
        advisory_text = get_static_fallback_advisory(
            disease_label, confidence, temperature, humidity, soil_moisture, risk_level
        )
        
    return {
        "disease": disease_label,
        "risk_level": risk_level,
        "advisory_markdown": advisory_text,
        "metadata": {
            "mode": mode_used,
            "model_requested": model_name if mode_used == "gemini_api" else "none"
        }
    }
