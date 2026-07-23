# PlantShield AI: Plant Risk Scoring Engine

This Python module implements the rule-based decision logic to calculate crop health vulnerability. It aggregates visual diagnostics (disease classification and model confidence) and ambient microclimate conditions (sensors and telemetry trends) to output a unified risk score.

---

## 1. Directory Structure

```text
risk-engine/
├── config.py             # Customizable thresholds, severities, and weights
├── risk_engine.py        # Decision logic and score calculation formulas
├── sample_test_cases.py  # Automation validation script containing 5 test cases
└── README.md             # This design and setup manual
```

---

## 2. Risk Calculation Algorithm

The Risk Engine calculates a final score from `0` to `100` and classifies it into levels:
*   **Low** ($<25$)
*   **Medium** ($25 \text{ to } 54.9$)
*   **High** ($55 \text{ to } 79.9$)
*   **Critical** ($\ge 80$)

### Formula
$$\text{Risk Score} = \text{Clamp}\Big( (\text{Disease Score} \times W_{\text{disease}}) + (\text{Environmental Score} \times W_{\text{env}}) + \text{Trend Adjustment}, \ 0, \ 100 \Big)$$

*   **Disease Score:** Derived from the base severity of the disease (loaded from `config.py`) multiplied by the PyTorch model's prediction confidence.
*   **Environmental Score:** Checks individual sensors (humidity, temperature, soil moisture) against stress thresholds, and takes their average.
*   **Trend Adjustment:** Adds custom offsets (e.g. $+5$ points) if recent trend metrics indicate conditions are worsening (e.g., humidity rising or soil drying out).

---

## 3. Integration Plan: How this Module is Called

Once the image is predicted and the sensor values are retrieved, the orchestration layer combines them to invoke the risk engine. Depending on your choice of backend orchestrator:

```text
  +------------------+         Image          +-----------------------+
  |  User Dashboard  | ---------------------->| Backend Orchestration |
  +------------------+                        +-----------------------+
                                                |       |           ^
        +---------------------------------------+       |           |
        | 1. POST /predict-image                        | 2. Query  | Telemetry
        v                                               v           |
+---------------------+                       +-----------------------+
|  Local AI (FastAPI) |                       | Amazon DynamoDB Table |
+---------------------+                       +-----------------------+
        |                                               |
        | Disease + Conf                                |
        +-----------------------+   +-------------------+
                                |   |
                                v   v
                      +-----------------------+
                      |   Risk Engine Module  |
                      +-----------------------+
                                |
                                v
                     Calculated Risk & Reasons
```

### In a Node.js Backend:
You can invoke this Python risk engine from Node.js using a child process execution:
```javascript
import { spawn } from 'child_process';

const runRiskEngine = (inputs) => {
    return new Promise((resolve, reject) => {
        const pythonProcess = spawn('python', [
            '-c',
            `import sys, json, risk_engine; print(json.dumps(risk_engine.calculate_risk(**json.loads(sys.argv[1]))))`
            , JSON.stringify(inputs)
        ]);
        
        let data = '';
        pythonProcess.stdout.on('data', (chunk) => data += chunk);
        pythonProcess.on('close', () => resolve(JSON.parse(data.trim())));
        pythonProcess.on('error', (err) => reject(err));
    });
};
```

---

## 4. Scaling to Disease-Specific Scoring (Future Enhancements)

Currently, the engine evaluates environmental stress generally. Fungal spores (like *Blast*) and bacterial infections (like *Bacterial Leaf Blight*) thrive in different conditions. 

To improve the risk engine later, we can map **Disease environmental profiles** in `config.py`:

```python
# Favorable incubation windows for specific diseases
DISEASE_PROFILES = {
    "blast": {
        "favorable_humidity_min": 85.0,
        "favorable_temp_min": 25.0,
        "favorable_temp_max": 28.0,
        "actionable_soil_moisture": "high"  # Blast thrives in saturated soils
    },
    "brown_spot": {
        "favorable_humidity_min": 80.0,
        "favorable_temp_min": 25.0,
        "favorable_temp_max": 32.0,
        "actionable_soil_moisture": "low"   # Brown spot is exacerbated by drought/stress
    }
}
```

### Custom Incubation Check
In `risk_engine.py`, if a disease is classified, we pull its environmental profile. 
*   If the current telemetry **matches** the profile (e.g. Blast is detected AND humidity is 88% and temp is 26°C), we apply an environmental multiplier to raise the risk score.
*   If the telemetry **does not match** (e.g. Blast is detected but humidity is dry at 45%), we lower the risk score since the pathogen is unlikely to spread in that environment.

---

## 5. Running the Test Suite

Verify the risk engine calculations by executing the automated test suite:

```bash
python sample_test_cases.py
```
This runs 5 simulated cases (Healthy, Drought, Incubation, Critical Outbreak, and Unclear Detection) and prints out the output reports in a readable format.
