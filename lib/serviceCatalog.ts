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
  // Compute — generic first, then AWS, then GCP
  { type: "genericServerless", label: "Serverless Function", description: "Stateless function or serverless compute (name it yourself)", category: "compute" },
  { type: "awsEc2", label: "EC2", description: "Virtual servers in the cloud", category: "compute" },
  { type: "awsLambda", label: "Lambda", description: "Run code without provisioning servers", category: "compute" },
  { type: "gcpCloudRun", label: "Cloud Run", description: "Fully managed serverless platform (GCP)", category: "compute" },
  { type: "gcpCloudFunctions", label: "Cloud Functions", description: "Event-driven serverless functions (GCP)", category: "compute" },
  { type: "gcpComputeEngine", label: "Compute Engine", description: "Virtual machines on Google Cloud", category: "compute" },
  { type: "awsFargate", label: "Fargate", description: "Serverless compute for containers", category: "containers" },
  { type: "awsEcs", label: "ECS", description: "Run containerized applications", category: "containers" },
  { type: "gcpGke", label: "GKE", description: "Managed Kubernetes on Google Cloud", category: "containers" },

  // Storage
  { type: "awsS3", label: "S3", description: "Scalable object storage", category: "storage" },
  { type: "awsEbs", label: "EBS", description: "Block storage for EC2", category: "storage" },
  { type: "gcpCloudStorage", label: "Cloud Storage", description: "Object storage on Google Cloud", category: "storage" },

  // Database — generic first, then AWS, then GCP
  { type: "genericNosql", label: "NoSQL DB", description: "Generic document or key-value database (name it yourself)", category: "database" },
  { type: "genericCache", label: "Key-Value Store", description: "Generic cache or key-value store (e.g. Redis, Memcached)", category: "database" },
  { type: "genericRelational", label: "Relational DB", description: "Generic SQL database (name it yourself)", category: "database" },
  { type: "awsDynamodb", label: "DynamoDB", description: "Managed NoSQL database", category: "database" },
  { type: "awsRds", label: "RDS", description: "Managed relational database", category: "database" },
  { type: "awsElasticache", label: "ElastiCache", description: "In-memory caching (Redis/Memcached)", category: "database" },
  { type: "awsRedis", label: "Redis", description: "In-memory cache/store (ElastiCache)", category: "database" },
  { type: "awsAurora", label: "Aurora", description: "MySQL/PostgreSQL-compatible relational DB", category: "database" },
  { type: "gcpCloudSql", label: "Cloud SQL", description: "Managed MySQL, PostgreSQL, SQL Server (GCP)", category: "database" },
  { type: "gcpCloudSpanner", label: "Cloud Spanner", description: "Globally distributed relational DB (GCP)", category: "database" },
  { type: "gcpAlloyDb", label: "AlloyDB", description: "PostgreSQL-compatible (GCP)", category: "database" },
  { type: "gcpBigQuery", label: "BigQuery", description: "Serverless data warehouse (GCP)", category: "database" },

  // Networking — generic first, then AWS, then GCP
  { type: "genericApi", label: "API", description: "HTTP API or gateway (name it yourself)", category: "networking" },
  { type: "awsApiGateway", label: "API Gateway", description: "Create and manage APIs", category: "networking" },
  { type: "awsElb", label: "ELB", description: "Distribute traffic across targets", category: "networking" },
  { type: "awsCloudfront", label: "CloudFront", description: "Content delivery network", category: "networking" },
  { type: "awsRoute53", label: "Route 53", description: "Scalable DNS and domain registration", category: "networking" },
  { type: "awsVpc", label: "VPC", description: "Isolated virtual network", category: "networking" },
  { type: "gcpApigee", label: "Apigee", description: "API management platform (GCP)", category: "networking" },
  { type: "gcpLoadBalancing", label: "Cloud Load Balancing", description: "Distribute traffic across instances (GCP)", category: "networking" },

  // Integration — generic first, then AWS, then GCP
  { type: "genericQueue", label: "Message Queue", description: "Async message queue or pub/sub (name it yourself)", category: "integration" },
  { type: "awsSqs", label: "SQS", description: "Managed message queuing", category: "integration" },
  { type: "awsSns", label: "SNS", description: "Pub/sub messaging and notifications", category: "integration" },
  { type: "awsEventbridge", label: "EventBridge", description: "Serverless event bus", category: "integration" },
  { type: "awsStepfunctions", label: "Step Functions", description: "Orchestrate distributed applications", category: "integration" },
  { type: "gcpPubSub", label: "Pub/Sub", description: "Messaging and event ingestion (GCP)", category: "integration" },

  // Security
  { type: "awsIam", label: "IAM", description: "Manage access to AWS services", category: "security" },
  { type: "awsCognito", label: "Cognito", description: "User sign-up, sign-in, and access control", category: "security" },
  { type: "awsWaf", label: "WAF", description: "Web application firewall", category: "security" },

  // Analytics
  { type: "awsKinesis", label: "Kinesis", description: "Real-time data streaming", category: "analytics" },
  { type: "awsRedshift", label: "Redshift", description: "Data warehouse", category: "analytics" },
  { type: "gcpVertexAi", label: "Vertex AI", description: "AI/ML platform on Google Cloud", category: "analytics" },

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

/** Generic (brandless) types sort to the top of each category. */
function isGenericType(type: string): boolean {
  return type.startsWith("generic");
}

export function getServicesByCategory(): Map<ServiceCategory, ServiceEntry[]> {
  const map = new Map<ServiceCategory, ServiceEntry[]>();
  for (const cat of CATEGORY_ORDER) {
    map.set(cat, []);
  }
  for (const svc of SERVICE_CATALOG) {
    const list = map.get(svc.category);
    if (list) list.push(svc);
  }
  const out = new Map<ServiceCategory, ServiceEntry[]>();
  for (const [cat, list] of map) {
    out.set(
      cat,
      [...list].sort((a, b) => (isGenericType(a.type) ? 0 : 1) - (isGenericType(b.type) ? 0 : 1))
    );
  }
  return out;
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
