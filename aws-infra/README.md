# AWS Ingestion Stack Setup Guide (AWS CDK)

This directory contains the AWS-side ingestion layer for **PlantShield AI**, structured as an **AWS Cloud Development Kit (CDK)** application. 

This enables you to deploy the entire ingestion pipeline (DynamoDB tables, IAM permissions, Lambda code, and AWS IoT Core rules) using a single command: `cdk deploy`.

---

## 1. Directory Structure

```text
aws-infra/
├── bin/
│   └── aws-infra.js       # CDK App bootstrap entrypoint
├── lib/
│   └── plantshield-infra-stack.js # CDK Infrastructure Stack Definition
├── lambda/
│   ├── index.mjs          # Node.js 18+ AWS Lambda handler
│   └── package.json       # Development config and SDK bindings
├── events/
│   └── sample_event.json  # Mock payload for AWS console test events
├── cdk.json               # CDK CLI execution context configurations
├── package.json           # CDK dependencies and deploy scripts
└── README.md              # This instruction manual
```

---

## 2. Ingestion Pipeline Flow

```text
+---------------------+     MQTT     +------------------+     Rule SQL     +--------------------+
|  ESP32 Sensor Node  | ------------>|   AWS IoT Core   | ---------------->| PlantShieldIngest  |
+---------------------+              +------------------+                  +--------------------+
                                                                                     |
                                                                                     v Triggers
+-------------------------------------------------------+                  +--------------------+
|                Amazon DynamoDB Tables                 |<-----------------| Telemetry Lambda   |
| 1. PlantShieldLatestState (Overwrites: deviceId)     |                  +--------------------+
| 2. PlantShieldHistoricalTelemetry (Appends logs, SK)  |
+-------------------------------------------------------+
```

---

## 3. Deployment Instructions

### Prerequisites
1.  **Node.js 18+** installed.
2.  **AWS CLI** installed and configured with credentials:
    ```bash
    aws configure
    ```
3.  **AWS CDK CLI** installed globally (or run using npx):
    ```bash
    npm install -g aws-cdk
    ```

### Step 1: Install CDK Dependencies
Navigate to the `aws-infra` folder and install the deployment packages:

```bash
cd "C:\Users\MEGHARAJU SAIKIRAN\.gemini\antigravity-ide\scratch\plantshield-ai\aws-infra"
npm install
```

### Step 2: Bootstrap Your AWS Account
If you have never deployed a CDK app to your AWS region before, bootstrap the environment (creates the S3 staging buckets for code assets):

```bash
cdk bootstrap
```

### Step 3: Deploy the Infrastructure
Compile and deploy the resources directly to your AWS Account:

```bash
cdk deploy
```

AWS CDK will prompt you to confirm the security modifications (IAM Role creation for the Lambda function). Type **`y`** and press **Enter** to proceed.

Once completed, CDK will print out the outputs:
*   `PlantShieldInfraStack.LatestStateTableName` = `PlantShieldLatestState`
*   `PlantShieldInfraStack.HistoricalTelemetryTableName` = `PlantShieldHistoricalTelemetry`
*   `PlantShieldInfraStack.LambdaFunctionArn` = `arn:aws:lambda:...:PlantShieldTelemetryIngest`

---

## 4. Verification & Testing

### Testing the Ingestion Pipeline
Once deployed, you can verify it immediately:
1.  Open the **AWS Lambda Console** and find the `PlantShieldTelemetryIngest` function.
2.  Click the **Test** tab.
3.  Create a new test event and paste the contents of `events/sample_event.json` into the editor.
4.  Click **Test**. You should see execution results status code `success`.
5.  Open the **Amazon DynamoDB Console**, select **Explore Items** for both the `PlantShieldLatestState` and `PlantShieldHistoricalTelemetry` tables, and verify the test items are successfully recorded!
