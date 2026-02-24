/**
 * Maps our node type (serviceCatalog type) to aws-icons architecture-service SVG filename.
 * Icons are loaded from the aws-icons package via CDN so no bundler config is needed.
 * @see https://www.npmjs.com/package/aws-icons
 */
const AWS_ICONS_BASE =
  "https://unpkg.com/aws-icons@3.2.0/icons/architecture-service";

/** AWS node types use prefix aws + camelCase name; values are aws-icons SVG filenames. */
const TYPE_TO_ICON: Record<string, string> = {
  awsEc2: "AmazonEC2.svg",
  awsLambda: "AWSLambda.svg",
  awsFargate: "AWSFargate.svg",
  awsEcs: "AmazonElasticContainerService.svg",
  awsS3: "AmazonSimpleStorageService.svg",
  awsEbs: "AmazonElasticBlockStore.svg",
  awsDynamodb: "AmazonDynamoDB.svg",
  awsRds: "AmazonRDS.svg",
  awsElasticache: "AmazonElastiCache.svg",
  awsRedis: "AmazonElastiCache.svg",
  awsAurora: "AmazonAurora.svg",
  awsApiGateway: "AmazonAPIGateway.svg",
  awsElb: "ElasticLoadBalancing.svg",
  awsCloudfront: "AmazonCloudFront.svg",
  awsRoute53: "AmazonRoute53.svg",
  awsVpc: "AmazonVirtualPrivateCloud.svg",
  awsSqs: "AmazonSimpleQueueService.svg",
  awsSns: "AmazonSimpleNotificationService.svg",
  awsEventbridge: "AmazonEventBridge.svg",
  awsStepfunctions: "AWSStepFunctions.svg",
  awsIam: "AWSIdentityandAccessManagement.svg",
  awsCognito: "AmazonCognito.svg",
  awsWaf: "AWSWAF.svg",
  awsKinesis: "AmazonKinesis.svg",
  awsRedshift: "AmazonRedshift.svg",
};

export function getAwsIconUrl(type: string): string | null {
  const filename = TYPE_TO_ICON[type];
  if (!filename) return null;
  return `${AWS_ICONS_BASE}/${filename}`;
}
