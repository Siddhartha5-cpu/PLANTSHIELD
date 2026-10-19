import os
import logging
import httpx

logger = logging.getLogger("inference-client")

# Load FastAPI AI inference target URL
FASTAPI_AI_URL = os.getenv("FASTAPI_AI_URL", "http://127.0.0.1:8000")

class AIServiceConnectionError(Exception):
    """Raised when the local FastAPI AI service is unreachable."""
    pass

async def predict_leaf_image(image_bytes: bytes, filename: str) -> dict:
    """
    Sends raw leaf image bytes as multipart/form-data to the local FastAPI 
    inference microservice, returning disease classifications.
    """
    target_url = f"{FASTAPI_AI_URL}/predict-image"
    logger.info(f"POSTing image {filename} to local AI inference service at {target_url}...")
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            files = {"file": (filename, image_bytes, "image/jpeg")}
            response = await client.post(target_url, files=files)
            
            if response.status_code != 200:
                logger.error(f"Inference service returned status {response.status_code}: {response.text}")
                raise AIServiceConnectionError(
                    f"AI Inference service returned an error status: {response.status_code}"
                )
                
            return response.json()
            
    except httpx.RequestError as exc:
        logger.error(f"Failed to connect to local AI service at {target_url}: {str(exc)}")
        raise AIServiceConnectionError(
            f"Cannot connect to the local AI inference service at {target_url}. "
            "Please ensure that the FastAPI service (Module 1) is running on port 8000."
        )

async def predict_leaf_image_gemini(image_bytes: bytes, filename: str, crop_name_input: str) -> dict:
    """
    Uses Google Gemini Vision API to classify disease for non-Paddy crops.
    """
    from google import genai
    from google.genai import types
    import json
    
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or api_key.startswith("YOUR_"):
        logger.warning("Gemini Vision API key is missing. Using mock fallback for Other crops.")
        return {
            "disease": {"class_id": 1, "class_name": "generic_rust", "confidence": 0.85},
            "top3_diseases": [
                {"class_id": 1, "class_name": "generic_rust", "confidence": 0.85}
            ],
            "variety": {"class_id": 0, "class_name": "Other Crop"},
            "estimated_age_days": 30.0,
            "metadata": {"device": "gemini_api"}
        }

    try:
        client = genai.Client(api_key=api_key)
        model_name = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
        
        prompt = (
            "You are an expert plant pathologist. Analyze this leaf image. "
            f"The user has indicated this is a '{crop_name_input}' crop. "
            "Identify the most likely disease (if any). "
            "Return the output strictly as a JSON object matching this schema: "
            "{\"disease\": \"disease_name_in_snake_case\", \"confidence\": 0.95, \"crop\": \"Crop Name\"} "
            "Use 'normal' if the leaf is completely healthy."
        )
        
        response = await client.aio.models.generate_content(
            model=model_name,
            contents=[
                types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg"),
                prompt
            ],
            config=types.GenerateContentConfig(
                response_mime_type="application/json"
            )
        )
        
        data = json.loads(response.text)
        disease_name = data.get("disease", "unknown").lower()
        confidence = float(data.get("confidence", 0.85))
        crop_name = data.get("crop", "Unknown Crop")
        
        return {
            "disease": {"class_id": 99, "class_name": disease_name, "confidence": confidence},
            "top3_diseases": [
                {"class_id": 99, "class_name": disease_name, "confidence": confidence}
            ],
            "variety": {"class_id": 0, "class_name": crop_name},
            "estimated_age_days": 30.0,
            "metadata": {"device": "gemini_api"}
        }
    except Exception as e:
        logger.error(f"Gemini Vision API failed: {str(e)}")
        raise AIServiceConnectionError(f"Gemini Vision API failed: {str(e)}")
