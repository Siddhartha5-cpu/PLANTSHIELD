# PlantShield AI: Gemini Advisory & Explanation Module

This module takes diagnostic classifications and active telemetry values to generate structured, farmer-friendly agronomic advisory reports. It leverages the **Google Gemini API** for rich dynamic analysis, and includes a **local static template fallback system** to handle offline conditions or missing credentials.

---

## 1. Directory Structure

```text
gemini-advisory/
├── .env.example          # Template for Gemini API credentials
├── prompt_builder.py     # Assembles the context-rich prompt for Gemini
├── gemini_advisory.py    # Google AI SDK client and static fallback templates
├── sample_runner.py      # Script to run test scenarios and inspect outputs
└── README.md             # This instruction manual
```

---

## 2. Pipeline Integration

This module sits at the **final step** of the diagnostic pipeline, consuming data from the AI inference service and the AWS ingestion layers:

```text
+------------------+     Image Upload     +----------------------+
|  User Dashboard  | -------------------->| Backend Orchestrator |
+------------------+                      +----------------------+
                                                     |
  +--------------------------------------------------+
  |
  |-- Step 1: Call Local AI -> Get Disease ("Blast", 94%)
  |-- Step 2: Query DynamoDB -> Get Telemetry (Temp: 28°C, Humidity: 88%)
  |-- Step 3: Run Risk Engine -> Get Risk Level ("Critical", Score: 85)
  |-- Step 4: Run Advisory Module -> Query Gemini API / Get Fallback Markdown
  |
  v
+-----------------------+     Markdown Report     +------------------+
| Ingestion & Advisory  | ----------------------->|  User Dashboard  |
+-----------------------+                         +------------------+
```

---

## 3. Setup Instructions

### Step 1: Install Dependencies
Install the required packages in your Python environment:

```bash
pip install google-generativeai python-dotenv
```

### Step 2: Configure the Environment Variables
1.  Copy `.env.example` to a new file named `.env`:
    ```bash
    cp .env.example .env
    ```
2.  Open `.env` and enter your Google AI Studio API Key:
    ```env
    GEMINI_API_KEY=AIzaSyD...
    ```
    *(Note: If the `GEMINI_API_KEY` is not set or left as a placeholder, the module will automatically route predictions to fallback templates, allowing you to run the app offline).*

---

## 4. How to Test

We have included a mock test runner simulating two agronomic scenarios (a high-confidence critical outbreak and a low-confidence warning case):

```bash
python sample_runner.py
```

### Verification Scenarios:
1.  **Test Fallback Mode:** Run the runner without creating a `.env` file (or with the default placeholder). The terminal will log a warning and return the pre-written static template markdown, proving database resilience.
2.  **Test Live API Mode:** Paste a valid key in `.env` and run the runner. The metadata mode will switch to `gemini_api` and output custom LLM reasoning based on your sensors.
