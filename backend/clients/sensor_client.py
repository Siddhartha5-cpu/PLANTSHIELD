import os
import logging
import boto3
from botocore.exceptions import BotoCoreError, ClientError

logger = logging.getLogger("sensor-client")

# Load DynamoDB configuration
TABLE_NAME = os.getenv("DYNAMODB_TABLE_LATEST", "PlantShieldLatestState")
REGION_NAME = os.getenv("AWS_REGION", "us-east-1")

# Pre-configured mock data matching the frontend device targets
MOCK_TELEMETRIES = {
    "ESP32-001": {
        "temperature": 28.5,
        "humidity": 82.1,
        "soilMoisture": 40.2,
        "lightIntensity": 450.0,
        "batteryLevel": 92.0
    },
    "ESP32-002": {  # Stressed dry environment
        "temperature": 35.0,
        "humidity": 40.0,
        "soilMoisture": 25.0,
        "lightIntensity": 780.0,
        "batteryLevel": 78.0
    },
    "ESP32-003": {  # Offline/Weak environment
        "temperature": 24.5,
        "humidity": 55.0,
        "soilMoisture": 50.0,
        "lightIntensity": 210.0,
        "batteryLevel": 12.0
    }
}

# Lazy instantiation of DynamoDB resource
db_resource = None
is_aws_available = False

access_key = os.getenv("AWS_ACCESS_KEY_ID")
secret_key = os.getenv("AWS_SECRET_ACCESS_KEY")

if access_key and not access_key.startswith("YOUR_"):
    try:
        # Initialize boto3 DynamoDB resource using environment variables
        db_resource = boto3.resource(
            'dynamodb',
            region_name=REGION_NAME,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key
        )
        is_aws_available = True
        logger.info(f"DynamoDB Resource client configured in region: {REGION_NAME}")
    except Exception as e:
        logger.error(f"Failed to instantiate boto3 DynamoDB client: {str(e)}")
else:
    logger.warning("AWS Credentials are missing or placeholder. Running in DynamoDB Mock Fallback mode.")

def fetch_latest_sensors(device_id: str) -> dict:
    """
    Fetches the latest telemetry state for device_id from DynamoDB.
    Gracefully falls back to mock telemetry if the AWS table is unreachable or unconfigured.
    """
    if is_aws_available and db_resource:
        try:
            logger.info(f"Querying DynamoDB table {TABLE_NAME} for deviceId: {device_id}...")
            table = db_resource.Table(TABLE_NAME)
            response = table.get_item(Key={"deviceId": device_id})
            
            if "Item" in response:
                item = response["Item"]
                logger.info(f"Successfully retrieved telemetry from DynamoDB for {device_id}")
                
                # Standardize database field mappings (dynamodb has soilMoisture, etc.)
                return {
                    "temperature": float(item.get("temperature", 25.0)),
                    "humidity": float(item.get("humidity", 60.0)),
                    "soilMoisture": float(item.get("soil_moisture", item.get("soilMoisture", 50.0))),
                    "lightIntensity": float(item["light_level"]) if "light_level" in item else (float(item["lightIntensity"]) if "lightIntensity" in item else None),
                    "batteryLevel": float(item["batteryLevel"]) if "batteryLevel" in item else None
                }
            else:
                logger.warning(f"Device ID '{device_id}' not found in DynamoDB. Using local mock data...")
        except (BotoCoreError, ClientError) as aws_err:
            logger.warning(f"DynamoDB get_item failed ({str(aws_err)}). Falling back to mock data...")
            
    # Mock Fallback logic
    logger.info(f"Generating mock telemetry fallback for device: {device_id}")
    fallback = MOCK_TELEMETRIES.get(device_id, {
        "temperature": 26.5,
        "humidity": 60.0,
        "soilMoisture": 55.0,
        "lightIntensity": 500.0,
        "batteryLevel": 100.0
    })
    return fallback
