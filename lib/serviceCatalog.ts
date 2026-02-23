export type ServiceCategory =
  | "compute"
  | "storage"
  | "database"
  | "networking"
  | "integration"
  | "security"
  | "containers"
  | "analytics"
  | "notes";

export type ServiceEntry = {
  readonly type: string;
  readonly label: string;
  readonly description: string;
  readonly category: ServiceCategory;
};

export const SERVICE_CATALOG: readonly ServiceEntry[] = [
  // Compute
  { type: "ec2", label: "EC2", description: "Virtual servers in the cloud", category: "compute" },
  { type: "lambda", label: "Lambda", description: "Run code without provisioning servers", category: "compute" },
  { type: "fargate", label: "Fargate", description: "Serverless compute for containers", category: "containers" },
  { type: "ecs", label: "ECS", description: "Run containerized applications", category: "containers" },

  // Storage
  { type: "s3", label: "S3", description: "Scalable object storage", category: "storage" },
  { type: "ebs", label: "EBS", description: "Block storage for EC2", category: "storage" },

  // Database
  { type: "dynamodb", label: "DynamoDB", description: "Managed NoSQL database", category: "database" },
  { type: "rds", label: "RDS", description: "Managed relational database", category: "database" },
  { type: "elasticache", label: "ElastiCache", description: "In-memory caching (Redis/Memcached)", category: "database" },
  { type: "redis", label: "Redis", description: "In-memory cache/store (ElastiCache)", category: "database" },
  { type: "aurora", label: "Aurora", description: "MySQL/PostgreSQL-compatible relational DB", category: "database" },

  // Networking
  { type: "apiGateway", label: "API Gateway", description: "Create and manage APIs", category: "networking" },
  { type: "elb", label: "ELB", description: "Distribute traffic across targets", category: "networking" },
  { type: "cloudfront", label: "CloudFront", description: "Content delivery network", category: "networking" },
  { type: "route53", label: "Route 53", description: "Scalable DNS and domain registration", category: "networking" },
  { type: "vpc", label: "VPC", description: "Isolated virtual network", category: "networking" },

  // Integration
  { type: "sqs", label: "SQS", description: "Managed message queuing", category: "integration" },
  { type: "sns", label: "SNS", description: "Pub/sub messaging and notifications", category: "integration" },
  { type: "eventbridge", label: "EventBridge", description: "Serverless event bus", category: "integration" },
  { type: "stepfunctions", label: "Step Functions", description: "Orchestrate distributed applications", category: "integration" },

  // Security
  { type: "iam", label: "IAM", description: "Manage access to AWS services", category: "security" },
  { type: "cognito", label: "Cognito", description: "User sign-up, sign-in, and access control", category: "security" },
  { type: "waf", label: "WAF", description: "Web application firewall", category: "security" },

  // Analytics
  { type: "kinesis", label: "Kinesis", description: "Real-time data streaming", category: "analytics" },
  { type: "redshift", label: "Redshift", description: "Data warehouse", category: "analytics" },

  // Notes (text box for requirements, traffic, etc.)
  { type: "text", label: "Text", description: "Notes, requirements, traffic", category: "notes" },
] as const;

export const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  compute: "Compute",
  storage: "Storage",
  database: "Database",
  networking: "Networking",
  integration: "Integration",
  security: "Security",
  containers: "Containers",
  analytics: "Analytics",
  notes: "Notes",
};

export const CATEGORY_ORDER: readonly ServiceCategory[] = [
  "notes",
  "compute",
  "networking",
  "storage",
  "database",
  "containers",
  "integration",
  "security",
  "analytics",
];

export function getServicesByCategory(): Map<ServiceCategory, ServiceEntry[]> {
  const map = new Map<ServiceCategory, ServiceEntry[]>();
  for (const cat of CATEGORY_ORDER) {
    map.set(cat, []);
  }
  for (const svc of SERVICE_CATALOG) {
    const list = map.get(svc.category);
    if (list) list.push(svc);
  }
  return map;
}

export function searchServices(query: string): ServiceEntry[] {
  const q = query.toLowerCase().trim();
  if (!q) return [...SERVICE_CATALOG];
  return SERVICE_CATALOG.filter(
    (s) =>
      s.label.toLowerCase().includes(q) ||
      s.type.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.category.toLowerCase().includes(q)
  );
}
