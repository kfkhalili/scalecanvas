/**
 * Maps our node type (serviceCatalog type) to aws-icons architecture-service SVG filename.
 * Icons are loaded from the aws-icons package via CDN so no bundler config is needed.
 * @see https://www.npmjs.com/package/aws-icons
 */
const AWS_ICONS_BASE =
  "https://unpkg.com/aws-icons@3.2.0/icons/architecture-service";

const TYPE_TO_ICON: Record<string, string> = {
  ec2: "AmazonEC2.svg",
  lambda: "AWSLambda.svg",
  fargate: "AWSFargate.svg",
  ecs: "AmazonElasticContainerService.svg",
  s3: "AmazonSimpleStorageService.svg",
  ebs: "AmazonElasticBlockStore.svg",
  dynamodb: "AmazonDynamoDB.svg",
  rds: "AmazonRDS.svg",
  elasticache: "AmazonElastiCache.svg",
  redis: "AmazonElastiCache.svg",
  aurora: "AmazonAurora.svg",
  apiGateway: "AmazonAPIGateway.svg",
  elb: "ElasticLoadBalancing.svg",
  cloudfront: "AmazonCloudFront.svg",
  route53: "AmazonRoute53.svg",
  vpc: "AmazonVirtualPrivateCloud.svg",
  sqs: "AmazonSimpleQueueService.svg",
  sns: "AmazonSimpleNotificationService.svg",
  eventbridge: "AmazonEventBridge.svg",
  stepfunctions: "AWSStepFunctions.svg",
  iam: "AWSIdentityandAccessManagement.svg",
  cognito: "AmazonCognito.svg",
  waf: "AWSWAF.svg",
  kinesis: "AmazonKinesis.svg",
  redshift: "AmazonRedshift.svg",
};

export function getAwsIconUrl(type: string): string | null {
  const filename = TYPE_TO_ICON[type];
  if (!filename) return null;
  return `${AWS_ICONS_BASE}/${filename}`;
}
