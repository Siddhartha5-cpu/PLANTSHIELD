import os
import sys
import requests
from PIL import Image, ImageDraw

URL_HEALTH = "http://127.0.0.1:8000/health"
URL_PREDICT = "http://127.0.0.1:8000/predict-image"

def generate_mock_image(filename="test_leaf.png"):
    """Generates a simple 224x224 green leaf-like square image for testing."""
    if not os.path.exists(filename):
        img = Image.new("RGB", (224, 224), color=(34, 139, 34)) # Forest Green
        draw = ImageDraw.Draw(img)
        # Draw a simulated leaf shape
        draw.ellipse([50, 20, 174, 204], fill=(50, 205, 50), outline=(255, 215, 0), width=3)
        img.save(filename)
        print(f"Generated a mock test image at: {os.path.abspath(filename)}")
    return filename

def test_service(image_path=None):
    print("=== Testing FastAPI Inference Service ===")
    
    # 1. Health check
    try:
        r_health = requests.get(URL_HEALTH)
        print(f"GET /health status code: {r_health.status_code}")
        print("Response:", r_health.json())
        print("-" * 50)
    except requests.exceptions.ConnectionError:
        print(f"ERROR: Could not connect to the service at {URL_HEALTH}.")
        print("Please ensure your FastAPI server is running (e.g., run `uvicorn main:app --reload` on port 8000).")
        sys.exit(1)

    # 2. Setup image path
    if not image_path:
        image_path = generate_mock_image()
    elif not os.path.exists(image_path):
        print(f"ERROR: The image file '{image_path}' does not exist.")
        sys.exit(1)

    # 3. Post image for prediction
    print(f"Sending image '{image_path}' to /predict-image...")
    try:
        with open(image_path, "rb") as img_file:
            files = {"file": (os.path.basename(image_path), img_file, "image/png")}
            r_predict = requests.post(URL_PREDICT, files=files)
            
        print(f"POST /predict-image status code: {r_predict.status_code}")
        print("Response JSON:")
        import json
        print(json.dumps(r_predict.json(), indent=2))
        
    except Exception as e:
        print(f"Failed to perform prediction request: {str(e)}")

if __name__ == "__main__":
    # If an image path argument is provided, use it
    target_img = sys.argv[1] if len(sys.argv) > 1 else None
    test_service(target_img)
