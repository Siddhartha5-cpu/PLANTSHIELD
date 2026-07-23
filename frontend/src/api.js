// API Service Layer for PlantShield AI
// Dynamically supports local mock fallback or live endpoints configured in Settings.

const DEFAULT_SETTINGS = {
  fastApiUrl: "http://127.0.0.1:5000", // Central Backend Orchestrator Port 5000
  awsApiGatewayUrl: "",
  geminiMockEnabled: true
};

// Retrieve settings from localStorage or fallback to defaults
export const getSettings = () => {
  const data = localStorage.getItem("plantshield_settings");
  return data ? JSON.parse(data) : { ...DEFAULT_SETTINGS };
};

export const saveSettings = (settings) => {
  localStorage.setItem("plantshield_settings", JSON.stringify(settings));
};

// --- Mock Data store ---
const MOCK_DEVICES = [
  { id: "ESP32-001", name: "Greenhouse Alpha A", status: "online", battery: 92, signal: "excellent", location: "Sector 4 - Paddy Bed A" }
];

const MOCK_TELEMETRY_HISTORY = {
  "ESP32-001": [
    { timestamp: "12:00", temperature: 26.5, humidity: 82.0, soilMoisture: 42.0 },
    { timestamp: "12:10", temperature: 27.2, humidity: 81.5, soilMoisture: 41.5 },
    { timestamp: "12:20", temperature: 27.8, humidity: 83.2, soilMoisture: 40.9 },
    { timestamp: "12:30", temperature: 28.5, humidity: 84.1, soilMoisture: 40.2 },
    { timestamp: "12:40", temperature: 28.3, humidity: 85.0, soilMoisture: 39.8 },
    { timestamp: "12:50", temperature: 28.0, humidity: 85.5, soilMoisture: 39.0 }
  ],
  "ESP32-002": [
    { timestamp: "12:00", temperature: 29.0, humidity: 75.0, soilMoisture: 32.0 },
    { timestamp: "12:10", temperature: 29.8, humidity: 74.8, soilMoisture: 31.0 },
    { timestamp: "12:20", temperature: 30.5, humidity: 73.0, soilMoisture: 29.5 },
    { timestamp: "12:30", temperature: 32.0, humidity: 72.1, soilMoisture: 28.0 },
    { timestamp: "12:40", temperature: 33.5, humidity: 70.8, soilMoisture: 26.5 },
    { timestamp: "12:50", temperature: 34.2, humidity: 70.0, soilMoisture: 25.0 }
  ]
};

const MOCK_HISTORY_LOG = [
  {
    id: "run-101",
    timestamp: "2026-07-14T12:00:00Z",
    deviceId: "ESP32-001",
    disease: "brown_spot",
    confidence: 0.94,
    variety: "IR20",
    estimatedAge: 45.2,
    riskScore: 68.5,
    riskLevel: "High"
  },
  {
    id: "run-102",
    timestamp: "2026-07-14T12:30:00Z",
    deviceId: "ESP32-001",
    disease: "normal",
    confidence: 0.99,
    variety: "ADT45",
    estimatedAge: 22.0,
    riskScore: 12.0,
    riskLevel: "Low"
  }
];

const MOCK_ALERTS = [
  { id: "alt-1", deviceId: "ESP32-002", type: "warning", message: "Critical low soil moisture (25%) detected. Drought stress warning.", time: "10 mins ago" },
  { id: "alt-2", deviceId: "ESP32-003", type: "danger", message: "Device offline. Battery status critically low (12%).", time: "1 hour ago" }
];

// --- API Methods ---

export const fetchDevices = async () => {
  const devices = [...MOCK_DEVICES];
  const settings = getSettings();
  
  if (settings.fastApiUrl) {
    try {
      const response = await fetch(`${settings.fastApiUrl}/latest-sensor/ESP32-001`);
      if (response.ok) {
        const telemetry = await response.json();
        // Merge real live metrics from DynamoDB
        devices[0].battery = telemetry.batteryLevel !== undefined && telemetry.batteryLevel !== null 
          ? telemetry.batteryLevel 
          : devices[0].battery;
        devices[0].status = "online";
      } else {
        devices[0].status = "offline";
      }
    } catch (err) {
      console.warn("Failed to fetch live gateway status, setting to offline:", err);
      devices[0].status = "offline";
    }
  }
  return devices;
};

export const fetchLatestTelemetry = async (deviceId) => {
  const settings = getSettings();
  if (settings.fastApiUrl) {
    try {
      const response = await fetch(`${settings.fastApiUrl}/latest-sensor/${deviceId}`);
      if (response.ok) {
        return await response.json();
      }
    } catch (err) {
      console.warn("Failed to fetch live sensors state, using mock fallback...", err);
    }
  }
  await new Promise(r => setTimeout(r, 200));
  const history = MOCK_TELEMETRY_HISTORY[deviceId] || MOCK_TELEMETRY_HISTORY["ESP32-001"];
  return history[history.length - 1];
};

export const fetchTelemetryHistory = async (deviceId) => {
  await new Promise(r => setTimeout(r, 400));
  return MOCK_TELEMETRY_HISTORY[deviceId] || MOCK_TELEMETRY_HISTORY["ESP32-001"];
};

export const fetchHistoryLogs = async () => {
  const settings = getSettings();
  if (settings.fastApiUrl) {
    try {
      const response = await fetch(`${settings.fastApiUrl}/history`);
      if (response.ok) {
        return await response.json();
      }
    } catch (err) {
      console.warn("Failed to fetch history logs from backend orchestrator, using mock...", err);
    }
  }
  await new Promise(r => setTimeout(r, 300));
  return [...MOCK_HISTORY_LOG];
};

export const fetchAlerts = async () => {
  await new Promise(r => setTimeout(r, 200));
  return [...MOCK_ALERTS];
};

// Central Upload and analysis hub (Routes directly to Backend Orchestrator)
export const uploadAndDiagnose = async (imageFile, deviceId) => {
  const settings = getSettings();
  
  if (!imageFile) {
    const telemetry = await fetchLatestTelemetry(deviceId);
    return {
      timestamp: new Date().toISOString(),
      deviceId: deviceId,
      disease: "normal",
      confidence: 1.0,
      top3_diseases: [{ class_name: "normal", confidence: 1.0 }],
      variety: "ADT45",
      estimatedAge: 22.0,
      telemetry: telemetry,
      riskScore: 12.0,
      riskLevel: "Low",
      riskReasons: ["Crop condition is normal. Maintain standard field observation."],
      advisory: "### 🌾 Crop Condition Summary\nLeaf appears healthy. Normal state is maintained.\n\n### ⚠️ Likely Concerns\nNone. Ambient metrics are safe.\n\n### 🛠️ Next Actions\n* Keep normal watering levels.",
      metadata: { advisory_mode: "static_fallback" }
    };
  }
  
  if (settings.fastApiUrl) {
    try {
      const formData = new FormData();
      formData.append("file", imageFile);
      formData.append("deviceId", deviceId);

      console.log(`POSTing leaf to orchestrator: ${settings.fastApiUrl}/analyze...`);
      const response = await fetch(`${settings.fastApiUrl}/analyze`, {
        method: "POST",
        body: formData
      });

      if (!response.ok) throw new Error("Orchestration backend returned error status");
      
      const completeDiagnostic = await response.json();
      
      // Update local mock history list so the dashboard UI synchronizes its lists
      MOCK_HISTORY_LOG.unshift({
        id: `run-${Date.now()}`,
        timestamp: completeDiagnostic.timestamp,
        deviceId: completeDiagnostic.deviceId,
        disease: completeDiagnostic.disease.class_name,
        confidence: completeDiagnostic.confidence || completeDiagnostic.disease.confidence,
        variety: completeDiagnostic.variety,
        estimatedAge: completeDiagnostic.estimatedAge,
        riskScore: completeDiagnostic.riskScore,
        riskLevel: completeDiagnostic.riskLevel
      });

      return {
        timestamp: completeDiagnostic.timestamp,
        deviceId: completeDiagnostic.deviceId,
        disease: completeDiagnostic.disease.class_name,
        confidence: completeDiagnostic.confidence || completeDiagnostic.disease.confidence,
        top3_diseases: completeDiagnostic.top3_diseases || [],
        variety: completeDiagnostic.variety,
        estimatedAge: completeDiagnostic.estimatedAge,
        telemetry: completeDiagnostic.telemetry,
        riskScore: completeDiagnostic.riskScore,
        riskLevel: completeDiagnostic.riskLevel,
        riskReasons: completeDiagnostic.riskReasons,
        advisory: completeDiagnostic.advisory,
        metadata: completeDiagnostic.metadata
      };

    } catch (err) {
      console.warn("Real Orchestrator call failed. Falling back to frontend simulated prediction. Error details:", err);
    }
  }

  // B. Mock Ingress Fallback (if real backend is off or throws error)
  await new Promise(r => setTimeout(r, 1200)); // Simulate execution latency
  const telemetry = await fetchLatestTelemetry(deviceId);
  const mockDiagnostic = {
    timestamp: new Date().toISOString(),
    deviceId: deviceId,
    disease: "blast",
    confidence: 0.912,
    top3_diseases: [
      { class_name: "blast", confidence: 0.912 },
      { class_name: "brown_spot", confidence: 0.065 },
      { class_name: "normal", confidence: 0.023 }
    ],
    variety: "IR20",
    estimatedAge: 38.5,
    telemetry: telemetry,
    riskScore: 78.4,
    riskLevel: "High",
    riskReasons: [
      "Visual analysis identified 'blast' disease with 91.2% confidence.",
      `High ambient relative humidity (${telemetry.humidity}%) creating favorable incubation environments.`
    ],
    advisory: "### 🌾 Crop Condition Summary\nSymptoms show high likelihood of **Rice Blast** infection.\n\n### ⚠️ Likely Concerns\nThe ambient relative humidity is above 80%. Spores germinate rapidly at warm temperatures.\n\n### 🛠️ Immediate Next Actions\n* Remove highly infected plant leaves manually.\n* Clear spacing weeds to decrease microclimate dampness.\n\n### 🛡️ Preventive Recommendations\n* Use balanced potassium fertilization to reinforce leaf cell strength.\n* Choose resistant cultivars like ADT45 in future seasons."
  };

  MOCK_HISTORY_LOG.unshift({
    id: `run-${Date.now()}`,
    timestamp: mockDiagnostic.timestamp,
    deviceId: mockDiagnostic.deviceId,
    disease: mockDiagnostic.disease,
    confidence: mockDiagnostic.confidence,
    variety: mockDiagnostic.variety,
    estimatedAge: mockDiagnostic.estimatedAge,
    riskScore: mockDiagnostic.riskScore,
    riskLevel: mockDiagnostic.riskLevel
  });

  return mockDiagnostic;
};

// Client-side replication of Module 3's Python Risk Engine logic
function calculateClientRisk(disease, confidence, temp, humidity, moisture) {
  let score = 0;
  const reasons = [];
  
  // Disease severity index
  const severities = { normal: 0, blast: 80, brown_spot: 70, tungro: 95 };
  const baseSev = severities[disease.toLowerCase()] !== undefined ? severities[disease.toLowerCase()] : 50;

  if (disease.toLowerCase() !== "normal") {
    score += baseSev * confidence * 0.6; // 60% weight
    reasons.append(`Identified symptoms of '${disease}' with ${Math.round(confidence*100)}% confidence.`);
  }

  // Environment stress (40% weight)
  let envStress = 0;
  if (humidity >= 80) {
    envStress += 75;
    reasons.push(`High ambient relative humidity (${humidity}%) promoting pathogen germination.`);
  }
  if (temp >= 25 && temp <= 32) {
    envStress += 80;
    reasons.push(`Air temperature (${temp}°C) is in the optimal incubation window.`);
  }
  if (moisture <= 35) {
    envStress += 80;
    reasons.push(`Low soil moisture (${moisture}%) triggers drought stress.`);
  }
  
  score += (envStress / 3) * 0.4;
  
  let level = "Low";
  if (score >= 80) level = "Critical";
  else if (score >= 55) level = "High";
  else if (score >= 25) level = "Medium";

  return { score: Math.round(score * 10) / 10, level, reasons };
}

function getClientMockAdvisory(disease, confidence, humidity, moisture) {
  if (disease.toLowerCase() === "normal") {
    return "### 🌾 Crop Condition Summary\nLeaf appears healthy. Normal state is maintained.\n\n### ⚠️ Likely Concerns\nNone. Ambient metrics are safe.\n\n### 🛠️ Immediate Next Actions\n* Keep normal watering levels.\n\n### 🛡️ Preventive Recommendations\n* Keep crop fields clean.";
  }
  return `### 🌾 Crop Condition Summary\nVisual diagnostic classified symptoms of **${disease}** (${Math.round(confidence*100)}% confidence).\n\n### ⚠️ Likely Concerns\nDamp conditions (Humidity: ${humidity}%) are supporting pathogen incubation.\n\n### 🛠️ Immediate Next Actions\n* Isolate the affected field zone.\n* Consult local extension agronomists.\n\n### 🛡️ Preventive Recommendations\n* Use crop rotation in future plantings.`;
}
