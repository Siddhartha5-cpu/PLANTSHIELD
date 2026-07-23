import os
import json
import logging
from PIL import Image
import torch
import torch.nn as nn
from torchvision import transforms
from model_def import PaddyMultiTaskModel

# Setup logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("inference")

# Constants
MODEL_PATH = os.path.join(os.path.dirname(__file__), "model", "best_model.pth")
LABELS_PATH = os.path.join(os.path.dirname(__file__), "labels.json")

# Load labels mapping
with open(LABELS_PATH, "r") as f:
    labels_data = json.load(f)

DISEASE_CLASSES = labels_data["diseases"]
VARIETY_CLASSES = labels_data["varieties"]

# Define Image Transform matching Kaggle baseline preprocessing
preprocess_pipeline = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    )
])

class ModelNotLoadedError(Exception):
    """Exception raised when the model weights file cannot be found or loaded."""
    pass

class InferenceEngine:
    def __init__(self, model_path=MODEL_PATH, device="cpu"):
        self.model_path = model_path
        self.device = torch.device(device)
        self.model = None
        self.is_loaded = False
        
        # Proactively load the model if the file exists
        try:
            self.load_model()
        except ModelNotLoadedError as e:
            logger.warning(f"Model initialization deferred: {str(e)}")

    def load_model(self):
        """Loads model weights onto the configured device."""
        if not os.path.exists(self.model_path):
            raise ModelNotLoadedError(
                f"Model file not found at '{self.model_path}'. "
                "Please place your trained 'best_model.pth' weights file in a 'model' subdirectory."
            )
        
        try:
            # Instantiate model definition with pretrained=False
            model = PaddyMultiTaskModel(model_name='resnet18', pretrained=False)
            
            # Load weights mapping to target device (CPU by default)
            state_dict = torch.load(self.model_path, map_location=self.device)
            model.load_state_dict(state_dict)
            model.to(self.device)
            model.eval()  # Set model to evaluation mode (turns off dropout/batchnorm)
            
            self.model = model
            self.is_loaded = True
            logger.info(f"Successfully loaded model weights from {self.model_path} onto {self.device}")
        except Exception as e:
            raise ModelNotLoadedError(f"Error loading model weights: {str(e)}")

    def predict(self, image_bytes: bytes):
        """
        Runs multi-task inference on the input image bytes.
        Returns:
            dict containing top disease predictions, variety prediction, and estimated age.
        """
        if not self.is_loaded or self.model is None:
            # Re-try loading in case the file was placed after server startup
            self.load_model()
            
        try:
            # Load and preprocess image
            image = Image.open(image_bytes).convert("RGB")
            input_tensor = preprocess_pipeline(image).unsqueeze(0).to(self.device)
        except Exception as e:
            raise ValueError(f"Failed to process image: {str(e)}")

        with torch.no_grad():
            out_disease, out_variety, out_age = self.model(input_tensor)
            
            # Calculate probabilities
            prob_d = torch.softmax(out_disease, dim=1).squeeze(0)
            prob_v = torch.softmax(out_variety, dim=1).squeeze(0)
            
            # Disease Top 3 predictions
            top3_prob, top3_indices = torch.topk(prob_d, 3)
            top3_list = []
            for prob, idx in zip(top3_prob, top3_indices):
                top3_list.append({
                    "class_id": int(idx.item()),
                    "class_name": DISEASE_CLASSES[idx.item()],
                    "confidence": float(prob.item())
                })
            
            # Primary predicted disease details
            primary_disease = top3_list[0]
            
            # Variety prediction details
            conf_v, id_v = torch.max(prob_v, dim=0)
            variety_details = {
                "class_id": int(id_v.item()),
                "class_name": VARIETY_CLASSES[id_v.item()],
                "confidence": float(conf_v.item())
            }
            
            # Crop age prediction (regression value in days)
            estimated_age = float(out_age.squeeze().item())
            
        return {
            "disease": primary_disease,
            "top3_diseases": top3_list,
            "variety": variety_details,
            "estimated_age_days": estimated_age
        }
