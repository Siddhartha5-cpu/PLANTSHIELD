# PlantShield AI: Local Inference Service

This directory contains the Python FastAPI local inference microservice for the **PlantShield AI** smart agriculture system. It loads the custom Multi-Task ResNet-18 model weights trained on the Paddy Doctor dataset and provides HTTP REST API endpoints.

---

## 1. Directory Structure

```text
ai-service/
├── model/
│   └── best_model.pth     # <-- PLACE YOUR TRAINED MODEL WEIGHTS HERE
├── model_def.py           # PyTorch Multi-Task Model definition
├── labels.json            # Alphabetical mapping arrays for diseases & varieties
├── inference.py           # Preprocessing pipeline and prediction wrapper
├── main.py                # FastAPI endpoints and startup routing
├── sample_test.py         # Automated requests validation script
├── requirements.txt       # Core project dependencies
└── README.md              # This instruction guide
```

---

## 2. Setup Instructions

### Step 1: Install Dependencies
It is highly recommended to use a Python virtual environment (`venv`).

```bash
# Create a virtual environment
python -m venv venv

# Activate the virtual environment
# On Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# On Windows (CMD):
.\venv\Scripts\activate.bat
# On Linux/macOS:
source venv/bin/activate

# Install the dependencies
pip install -r requirements.txt
```

### Step 2: Place the Trained Model File
1. Create a folder named `model` inside the `ai-service` directory.
2. Copy your trained PyTorch weights file and rename it to **`best_model.pth`**.
   * Path should be: `ai-service/model/best_model.pth`

*(Note: If the model file is not present when starting the server, the `/health` endpoint will report a missing model status, and any request to `/predict-image` will return a helpful `503 Service Unavailable` explaining where to place the file.)*

---

## 3. Running the Server

Start the local server using `uvicorn`:

```bash
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

The service will start running on: **`http://127.0.0.1:8000`**
*   Open **`http://127.0.0.1:8000/docs`** in your browser to view the interactive Swagger API documentation.

---

## 4. Testing Endpoints

### Option A: Using the Test Script
We have included a test script that generates a simulated leaf image and makes the API calls for you. Run it in a separate terminal:

```bash
python sample_test.py
```

### Option B: Using `curl` (CommandLine)
If you have a real leaf image (e.g., `leaf.jpg`) you can upload it using standard command line utility:

```bash
curl -X POST "http://127.0.0.1:8000/predict-image" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@leaf.jpg"
```

---

## 5. API Reference

### **GET `/health`**
Verifies the service status and checks if the PyTorch weights are loaded.
*   **Response:**
    ```json
    {
      "status": "healthy",
      "model_loaded": true,
      "message": "Model weights are successfully loaded and ready for predictions."
    }
    ```

### **POST `/predict-image`**
Receives a leaf image, runs multi-task model inference, and returns prediction details.
*   **Response:**
    ```json
    {
      "status": "success",
      "disease": {
        "class_id": 4,
        "class_name": "brown_spot",
        "confidence": 0.9423
      },
      "top3_diseases": [
        { "class_id": 4, "class_name": "brown_spot", "confidence": 0.9423 },
        { "class_id": 3, "class_name": "blast", "confidence": 0.0410 },
        { "class_id": 1, "class_name": "bacterial_leaf_streak", "confidence": 0.0112 }
      ],
      "variety": {
        "class_id": 3,
        "class_name": "IR20",
        "confidence": 0.8872
      },
      "estimated_age_days": 45.2,
      "metadata": {
        "inference_time_ms": 112.4,
        "device": "cpu"
      }
    }
    ```
