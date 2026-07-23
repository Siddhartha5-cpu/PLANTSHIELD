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
