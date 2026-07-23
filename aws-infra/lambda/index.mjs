import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";

// Configure region. If deployed inside AWS Lambda, it defaults to the host region.
const REGION = process.env.AWS_REGION || "us-east-1";
const ddbClient = new DynamoDBClient({ region: REGION });

const TABLE_LATEST = "PlantShieldLatestState";
const TABLE_HISTORICAL = "PlantShieldHistoricalTelemetry";

export const handler = async (event) => {
    console.log("Received incoming IoT telemetry event:", JSON.stringify(event));

    // 1. Extract and validate mandatory fields
    const { deviceId, timestamp, temperature, humidity, soilMoisture } = event;

    if (!deviceId) {
        console.error("Validation Error: Missing mandatory attribute 'deviceId'");
        return { status: "error", message: "Missing deviceId" };
    }

    if (temperature === undefined || humidity === undefined || soilMoisture === undefined) {
        console.error("Validation Error: Missing sensor metrics (temperature, humidity, or soilMoisture)");
        return { status: "error", message: "Missing core sensor parameters" };
    }

    // Convert raw MQTT millisecond timestamp to ISO 8601 string for DynamoDB sorting
    const dateObj = timestamp ? new Date(timestamp) : new Date();
    const timestampIso = dateObj.toISOString();

    // 2. Prepare optional parameters
    const lightIntensity = event.lightIntensity !== undefined ? Number(event.lightIntensity) : null;
    const batteryLevel = event.batteryLevel !== undefined ? Number(event.batteryLevel) : null;

    // 3. Compute TTL for historical record (30 days from now)
    const retentionSeconds = 30 * 24 * 60 * 60; // 30 days
    const ttlEpochSeconds = Math.floor(Date.now() / 1000) + retentionSeconds;

    try {
        // 4. Build Latest State Payload (No TTL required)
        const latestPayload = {
            deviceId: String(deviceId),
            timestamp: timestampIso,
            temperature: Number(temperature),
            humidity: Number(humidity),
            soilMoisture: Number(soilMoisture),
            updatedAt: new Date().toISOString()
        };
        if (lightIntensity !== null) latestPayload.lightIntensity = lightIntensity;
        if (batteryLevel !== null) latestPayload.batteryLevel = batteryLevel;

        // 5. Build Historical Telemetry Payload (Include SK 'timestamp' and 'ttl')
        const historicalPayload = {
            deviceId: String(deviceId),
            timestamp: timestampIso,
            temperature: Number(temperature),
            humidity: Number(humidity),
            soilMoisture: Number(soilMoisture),
            ttl: ttlEpochSeconds
        };
        if (lightIntensity !== null) historicalPayload.lightIntensity = lightIntensity;
        if (batteryLevel !== null) historicalPayload.batteryLevel = batteryLevel;

        // 6. Write to both DynamoDB tables in parallel to minimize Lambda execution time
        console.log(`Writing telemetry data for device ${deviceId} to DynamoDB...`);
        
        await Promise.all([
            ddbClient.send(new PutItemCommand({
                TableName: TABLE_LATEST,
                Item: marshall(latestPayload, { removeUndefinedValues: true })
            })),
            ddbClient.send(new PutItemCommand({
                TableName: TABLE_HISTORICAL,
                Item: marshall(historicalPayload, { removeUndefinedValues: true })
            }))
        ]);

        console.log(`Successfully completed DynamoDB writes for device ${deviceId}`);
        return {
            status: "success",
            deviceId: deviceId,
            timestamp: timestampIso
        };

    } catch (error) {
        console.error("Database Write Exception encountered:", error);
        // Throwing the error alerts AWS Lambda that the invocation failed
        throw error;
    }
};
