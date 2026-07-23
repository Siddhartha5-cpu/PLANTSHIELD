# AWS Infrastructure Notes: PlantShield AI Sensor Ingestion

This document details the architecture design, data routing queries, database schemas, and security permissions for the AWS-side ingestion layer.

---

## 1. MQTT Topic Structure

We use a hierarchical MQTT topic structure that separates devices dynamically:

*   **Topic Scheme:** `plants/<deviceId>/telemetry`
*   **Example Topic:** `plants/ESP32-001/telemetry`

### Why this is a best practice:
1.  **Device Segregation:** Allows fine-grained access control policies. Each ESP32 can be restricted to only publish to its own topic (e.g., `plants/${iot:ClientId}/telemetry`), preventing compromised nodes from spoofing other devices.
2.  **Wildcard Ingestion:** The IoT rule can listen to all devices simultaneously using the `+` single-level wildcard: `plants/+/telemetry`.

---

## 2. AWS IoT SQL Rule

To capture incoming telemetry, parse it, and route it to our Lambda function, we create an AWS IoT Rule with the following SQL definition.

*   **Rule Name:** `PlantShieldIngestRule`
*   **SQL Version:** `2016-03-23`
*   **SQL Query:**
    ```sql
    SELECT 
      topic(2) AS deviceId,
      timestamp() AS timestamp,
      temperature,
      humidity,
      soilMoisture,
      lightIntensity,
      batteryLevel
    FROM 'plants/+/telemetry'
    ```

### How this query transforms the data:
*   `topic(2)` extracts the second segment of the topic (e.g., `ESP32-001`) and assigns it as `deviceId`.
*   `timestamp()` generates an AWS-side epoch timestamp (in milliseconds) representing when the message was received.
*   The query explicitly selects environmental attributes, allowing the ESP32 to optionally omit `lightIntensity` or `batteryLevel` without causing schema issues.

---

## 3. Amazon DynamoDB Schema Specifications

We deploy two separate DynamoDB tables to split real-time queries from historical reports:

### A. Table 1: `PlantShieldLatestState`
Stores only the single most recent state for each sensor node.

*   **Partition Key (PK):** `deviceId` (Type: `String`)
*   **Sort Key (SK):** None
*   **Indexes:** None
*   **Write behavior:** Overwrites the row for the `deviceId` using a `PutItem` command.
*   **API Usage:** Used by the local Backend Orchestrator to quickly fetch the current conditions of a field.

### B. Table 2: `PlantShieldHistoricalTelemetry`
Stores a rolling timeline of all telemetry readings.

*   **Partition Key (PK):** `deviceId` (Type: `String`)
*   **Sort Key (SK):** `timestamp` (Type: `String` or `Number` — we store as a String formatted in ISO 8601 or raw Milliseconds string)
*   **Time-to-Live (TTL):** Enabled on attribute **`ttl`** (Type: `Number` - Epoch seconds)
*   **Write behavior:** Appends a new item for every incoming message.
*   **API Usage:** Used by the dashboard to draw historical charts. Old records are auto-deleted by DynamoDB after 30 days to stay within AWS Free Tier limits.

---

## 4. IAM Permissions for Lambda Role

The AWS Lambda function needs permissions to write to these tables. Associate this custom IAM Policy with your Lambda's execution role:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DynamoDBWritePermissions",
      "Effect": "Allow",
      "Action": [
        "dynamodb:PutItem",
        "dynamodb:UpdateItem"
      ],
      "Resource": [
        "arn:aws:dynamodb:YOUR_AWS_REGION:YOUR_ACCOUNT_ID:table/PlantShieldLatestState",
        "arn:aws:dynamodb:YOUR_AWS_REGION:YOUR_ACCOUNT_ID:table/PlantShieldHistoricalTelemetry"
      ]
    },
    {
      "Sid": "LambdaLogging",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    }
  ]
}
```
*(Replace `YOUR_AWS_REGION` and `YOUR_ACCOUNT_ID` with your actual AWS values during configuration).*
