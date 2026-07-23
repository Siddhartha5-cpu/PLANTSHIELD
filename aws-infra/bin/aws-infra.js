#!/usr/bin/env node
const cdk = require('aws-cdk-lib');
const { PlantShieldInfraStack } = require('../lib/plantshield-infra-stack');

const app = new cdk.App();
new PlantShieldInfraStack(app, 'PlantShieldInfraStack', {
  /* If you don't specify 'env', this stack will be environment-agnostic.
   * Account/Region-dependent features and context lookups will not work,
   * but a single synthesized template can be deployed anywhere. */

  /* Uncomment the next line to specialize this stack for the AWS Account
   * and Region that are implied by the current CLI configuration. */
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1' 
  },
});
