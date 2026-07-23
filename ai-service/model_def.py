import torch
import torch.nn as nn
import timm

class PaddyMultiTaskModel(nn.Module):
    """
    Multi-Task ResNet-18 model for Paddy Disease Classification.
    Extracts deep visual features using a shared ResNet-18 backbone,
    then predicts:
    1. Disease label (10 classes)
    2. Variety label (10 classes)
    3. Crop age (1 output regression)
    """
    def __init__(self, model_name='resnet18', pretrained=False):
        super().__init__()
        
        # Load backbone without classification heads (num_classes=0)
        self.backbone = timm.create_model(model_name, pretrained=pretrained, num_classes=0)
        n_features = self.backbone.num_features
        
        # Fully connected heads
        self.fc_disease = nn.Linear(n_features, 10)  # 10 disease categories
        self.fc_variety = nn.Linear(n_features, 10)  # 10 paddy variety categories
        self.fc_age     = nn.Linear(n_features, 1)   # 1 continuous scalar (crop age in days)

    def forward(self, x):
        features = self.backbone(x)
        
        out_disease = self.fc_disease(features)
        out_variety = self.fc_variety(features)
        out_age     = self.fc_age(features)
        
        return out_disease, out_variety, out_age
