from pydantic import BaseModel
from typing import List, Optional

class TelemetryInfo(BaseModel):
    temperature: float
    humidity: float
    soilMoisture: float
    lightIntensity: Optional[float] = None
    batteryLevel: Optional[float] = None

class DiseaseDetail(BaseModel):
    class_id: int
    class_name: str
    confidence: float

class AnalysisReport(BaseModel):
    timestamp: str
    deviceId: str
    disease: DiseaseDetail
    top3_diseases: List[DiseaseDetail]
    variety: str
    estimatedAge: float
    telemetry: TelemetryInfo
    riskScore: float
    riskLevel: str
    riskReasons: List[str]
    advisory: str
    metadata: dict

class HistoryLogItem(BaseModel):
    id: str
    timestamp: str
    deviceId: str
    disease: str
    confidence: float
    variety: str
    estimatedAge: float
    riskScore: float
    riskLevel: str
