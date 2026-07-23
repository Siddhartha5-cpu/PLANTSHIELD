import time
import io
import logging
from fastapi import FastAPI, File, UploadFile, HTTPException, status
from fastapi.responses import JSONResponse
from inference import InferenceEngine, ModelNotLoadedError

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("api")

# Initialize FastAPI application
app = FastAPI(
    title="PlantShield AI Inference Service",
    description="Local AI inference backend to predict paddy crop diseases, varieties, and crop age.",
    version="1.0.0"
)

# Instantiate the Inference Engine on CPU by default
engine = InferenceEngine(device="cpu")

@app.get("/health")
async def health_check():
    """
    Checks the service health and checks if the PyTorch weights are loaded.
    """
    return {
        "status": "healthy",
        "model_loaded": engine.is_loaded,
        "message": (
            "Model weights are successfully loaded and ready for predictions."
            if engine.is_loaded else
            "Service is running, but model weights are not loaded. "
            "Please place best_model.pth in the 'model/' directory."
        )
    }

@app.post("/predict-image")
async def predict_image(file: UploadFile = File(...)):
    """
    Receives a leaf image, runs multi-task model inference, 
    and returns paddy disease classification, variety classification, 
    estimated age, and execution metadata.
    """
    # 1. Validate file extension
    content_type = file.content_type or ""
    if not (content_type.startswith("image/") or file.filename.lower().endswith(('.png', '.jpg', '.jpeg'))):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file must be a valid image (JPEG/PNG)."
        )

    # 2. Check if model is loaded, or try lazy-loading
    if not engine.is_loaded:
        try:
            logger.info("Attempting lazy loading of model weights...")
            engine.load_model()
        except ModelNotLoadedError as e:
            logger.error(f"Inference request failed: {str(e)}")
            return JSONResponse(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                content={
                    "error": "ModelWeightsMissing",
                    "message": str(e),
                    "instructions": (
                        "Create a folder named 'model' inside the 'ai-service/' folder, "
                        "place your trained 'best_model.pth' inside it, and restart the service."
                    )
                }
            )

    # 3. Read image bytes and run prediction
    try:
        image_bytes = await file.read()
        start_time = time.time()
        
        # Call inference engine
        prediction_results = engine.predict(io.BytesIO(image_bytes))
        
        elapsed_time_ms = (time.time() - start_time) * 1000
        
    except ValueError as ve:
        logger.error(f"Image processing error: {str(ve)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid image format: {str(ve)}"
        )
    except Exception as e:
        logger.error(f"Inference error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Inference engine failed: {str(e)}"
        )

    # 4. Return combined results
    return {
        "status": "success",
        "disease": prediction_results["disease"],
        "top3_diseases": prediction_results["top3_diseases"],
        "variety": prediction_results["variety"],
        "estimated_age_days": prediction_results["estimated_age_days"],
        "metadata": {
            "inference_time_ms": round(elapsed_time_ms, 2),
            "device": str(engine.device)
        }
    }

if __name__ == "__main__":
    import uvicorn
    # Start uvicorn server locally on port 8000
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
