const cdk = require('aws-cdk-lib');
const dynamodb = require('aws-cdk-lib/aws-dynamodb');
const lambda = require('aws-cdk-lib/aws-lambda');
const iam = require('aws-cdk-lib/aws-iam');
const iot = require('aws-cdk-lib/aws-iot');
const path = require('path');

class PlantShieldInfraStack extends cdk.Stack {
  /**
   * @param {cdk.App} scope
   * @param {string} id
   * @param {cdk.StackProps=} props
   */
  constructor(scope, id, props) {
    super(scope, id, props);

    // 1. Create DynamoDB Table for Latest Telemetry State (Key: deviceId)
    const latestStateTable = new dynamodb.Table(this, 'PlantShieldLatestStateTable', {
      tableName: 'PlantShieldLatestState',
      partitionKey: { name: 'deviceId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // On-demand scaling (perfect for Free Tier)
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Deletes table during stack destruction (turn to RETAIN in production)
    });

    // 2. Create DynamoDB Table for Historical Logs (Keys: deviceId + timestamp)
    const historicalTelemetryTable = new dynamodb.Table(this, 'PlantShieldHistoricalTelemetryTable', {
      tableName: 'PlantShieldHistoricalTelemetry',
      partitionKey: { name: 'deviceId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl', // Auto-expires historical logs based on 'ttl' field
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // 3. Create the Telemetry Ingestion Lambda Function
    const ingestLambda = new lambda.Function(this, 'PlantShieldTelemetryIngestLambda', {
      functionName: 'PlantShieldTelemetryIngest',
      runtime: lambda.Runtime.NODEJS_20_X, // Use latest Node.js runtime
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda')),
      environment: {
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
      },
    });

    // 4. Grant write access to the Lambda function for both DynamoDB Tables
    latestStateTable.grantWriteData(ingestLambda);
    historicalTelemetryTable.grantWriteData(ingestLambda);

    // 5. Create the AWS IoT Core Topic Rule to capture ESP32 telemetry
    const iotRule = new iot.CfnTopicRule(this, 'PlantShieldIngestRule', {
      ruleName: 'PlantShieldIngestRule',
      topicRulePayload: {
        sql: "SELECT topic(2) AS deviceId, timestamp() AS timestamp, temperature, humidity, soilMoisture, lightIntensity, batteryLevel FROM 'plants/+/telemetry'",
        actions: [
          {
            lambda: {
              functionArn: ingestLambda.functionArn,
            },
          },
        ],
        ruleDisabled: false,
      },
    });

    // 6. Grant AWS IoT Core Service permission to invoke the Ingest Lambda
    ingestLambda.addPermission('AllowIotCoreTrigger', {
      principal: new iam.ServicePrincipal('iot.amazonaws.com'),
      sourceArn: `arn:aws:iot:${this.region}:${this.account}:rule/${iotRule.ruleName}`,
      action: 'lambda:InvokeFunction'
    });

    // 7. Output resource identifiers for convenience
    new cdk.CfnOutput(this, 'LatestStateTableName', {
      value: latestStateTable.tableName,
      description: 'The name of the DynamoDB table storing the latest state for each device',
    });

    new cdk.CfnOutput(this, 'HistoricalTelemetryTableName', {
      value: historicalTelemetryTable.tableName,
      description: 'The name of the DynamoDB table storing the historical timeline data',
    });

    new cdk.CfnOutput(this, 'LambdaFunctionArn', {
      value: ingestLambda.functionArn,
      description: 'The ARN of the telemetry ingestion Lambda function',
    });
  }
}

module.exports = { PlantShieldInfraStack };
