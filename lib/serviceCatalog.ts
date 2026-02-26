import type { NodeLibraryProvider } from "@/lib/types";

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
  { type: "genericServerless", label: "Serverless Function", description: "Stateless function or serverless compute (Generic)", category: "compute" },
  { type: "awsEc2", label: "EC2", description: "Virtual servers in the cloud (AWS)", category: "compute" },
  { type: "awsLambda", label: "Lambda", description: "Run code without provisioning servers (AWS)", category: "compute" },
  { type: "gcpCloudRun", label: "Cloud Run", description: "Fully managed serverless platform (GCP)", category: "compute" },
  { type: "gcpCloudFunctions", label: "Cloud Functions", description: "Event-driven serverless functions (GCP)", category: "compute" },
  { type: "gcpComputeEngine", label: "Compute Engine", description: "Virtual machines (GCP)", category: "compute" },
  { type: "azureFunctions", label: "Azure Functions", description: "Serverless functions (Azure)", category: "compute" },
  { type: "awsFargate", label: "Fargate", description: "Serverless compute for containers (AWS)", category: "containers" },
  { type: "awsEcs", label: "ECS", description: "Run containerized applications (AWS)", category: "containers" },
  { type: "gcpGke", label: "GKE", description: "Managed Kubernetes (GCP)", category: "containers" },

  // Storage
  { type: "awsS3", label: "S3", description: "Scalable object storage (AWS)", category: "storage" },
  { type: "awsEbs", label: "EBS", description: "Block storage for EC2 (AWS)", category: "storage" },
  { type: "gcpCloudStorage", label: "Cloud Storage", description: "Object storage (GCP)", category: "storage" },
  { type: "azureBlobStorage", label: "Blob Storage", description: "Object storage (Azure)", category: "storage" },

  // Database — generic first, then AWS, then GCP, then Azure
  { type: "genericNosql", label: "NoSQL DB", description: "Generic document or key-value database (Generic)", category: "database" },
  { type: "genericCache", label: "Key-Value Store", description: "Generic cache or key-value store (e.g. Redis, Memcached)", category: "database" },
  { type: "genericRelational", label: "Relational DB", description: "Generic SQL database (Generic)", category: "database" },
  { type: "awsDynamodb", label: "DynamoDB", description: "Managed NoSQL database (AWS)", category: "database" },
  { type: "awsRds", label: "RDS", description: "Managed relational database (AWS)", category: "database" },
  { type: "awsElasticache", label: "ElastiCache", description: "In-memory caching Redis/Memcached (AWS)", category: "database" },
  { type: "awsRedis", label: "Redis", description: "In-memory cache/store (AWS)", category: "database" },
  { type: "awsAurora", label: "Aurora", description: "MySQL/PostgreSQL-compatible relational DB (AWS)", category: "database" },
  { type: "awsDocumentdb", label: "DocumentDB", description: "MongoDB-compatible document database (AWS)", category: "database" },
  { type: "awsNeptune", label: "Neptune", description: "Graph database (AWS)", category: "database" },
  { type: "awsOpensearch", label: "OpenSearch", description: "Search and analytics (AWS)", category: "database" },
  { type: "gcpCloudSql", label: "Cloud SQL", description: "Managed MySQL, PostgreSQL, SQL Server (GCP)", category: "database" },
  { type: "gcpCloudSpanner", label: "Cloud Spanner", description: "Globally distributed relational DB (GCP)", category: "database" },
  { type: "gcpAlloyDb", label: "AlloyDB", description: "PostgreSQL-compatible (GCP)", category: "database" },
  { type: "gcpBigQuery", label: "BigQuery", description: "Serverless data warehouse (GCP)", category: "database" },
  { type: "azureCosmosDb", label: "Cosmos DB", description: "Globally distributed NoSQL (Azure)", category: "database" },

  // Networking — generic first, then AWS, then GCP
  { type: "genericApi", label: "API", description: "HTTP API or gateway (Generic)", category: "networking" },
  { type: "awsApiGateway", label: "API Gateway", description: "Create and manage APIs (AWS)", category: "networking" },
  { type: "awsElb", label: "ELB", description: "Distribute traffic across targets (AWS)", category: "networking" },
  { type: "awsCloudfront", label: "CloudFront", description: "Content delivery network (AWS)", category: "networking" },
  { type: "awsRoute53", label: "Route 53", description: "Scalable DNS and domain registration (AWS)", category: "networking" },
  { type: "awsVpc", label: "VPC", description: "Isolated virtual network (AWS)", category: "networking" },
  { type: "gcpApigee", label: "Apigee", description: "API management platform (GCP)", category: "networking" },
  { type: "gcpLoadBalancing", label: "Cloud Load Balancing", description: "Distribute traffic across instances (GCP)", category: "networking" },

  // Integration — generic first, then AWS, then GCP
  { type: "genericQueue", label: "Message Queue", description: "Async message queue or pub/sub (Generic)", category: "integration" },
  { type: "awsSqs", label: "SQS", description: "Managed message queuing (AWS)", category: "integration" },
  { type: "awsSns", label: "SNS", description: "Pub/sub messaging and notifications (AWS)", category: "integration" },
  { type: "awsEventbridge", label: "EventBridge", description: "Serverless event bus (AWS)", category: "integration" },
  { type: "awsStepfunctions", label: "Step Functions", description: "Orchestrate distributed applications (AWS)", category: "integration" },
  { type: "gcpPubSub", label: "Pub/Sub", description: "Messaging and event ingestion (GCP)", category: "integration" },
  { type: "azureServiceBus", label: "Service Bus", description: "Message queue and topic messaging (Azure)", category: "integration" },
  { type: "azureEventHubs", label: "Event Hubs", description: "Event streaming at scale (Azure)", category: "integration" },

  // Security
  { type: "awsIam", label: "IAM", description: "Manage access to AWS services (AWS)", category: "security" },
  { type: "awsCognito", label: "Cognito", description: "User sign-up, sign-in, and access control (AWS)", category: "security" },
  { type: "awsWaf", label: "WAF", description: "Web application firewall (AWS)", category: "security" },
  { type: "azureKeyVault", label: "Key Vault", description: "Secrets and key management (Azure)", category: "security" },

  // Analytics
  { type: "awsKinesis", label: "Kinesis", description: "Real-time data streaming (AWS)", category: "analytics" },
  { type: "awsRedshift", label: "Redshift", description: "Data warehouse (AWS)", category: "analytics" },
  { type: "gcpVertexAi", label: "Vertex AI", description: "AI/ML platform (GCP)", category: "analytics" },

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

export function getProviderFromType(type: string): NodeLibraryProvider {
  if (type.startsWith("aws")) return "aws";
  if (type.startsWith("gcp")) return "gcp";
  if (type.startsWith("azure")) return "azure";
  if (type.startsWith("generic")) return "generic";
  if (type === "text") return "generic";
  return "generic";
}

export function getServicesByCategory(
  providers: readonly NodeLibraryProvider[]
): Map<ServiceCategory, ServiceEntry[]> {
  const catalog =
    providers.length === 0
      ? [...SERVICE_CATALOG]
      : SERVICE_CATALOG.filter((s) => providers.includes(getProviderFromType(s.type)));

  const map = new Map<ServiceCategory, ServiceEntry[]>();
  for (const cat of CATEGORY_ORDER) {
    map.set(cat, []);
  }
  for (const svc of catalog) {
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

export function searchServices(
  query: string,
  providers?: readonly NodeLibraryProvider[]
): ServiceEntry[] {
  const q = query.toLowerCase().trim();
  let results: ServiceEntry[] =
    !q
      ? [...SERVICE_CATALOG]
      : SERVICE_CATALOG.filter(
          (s) =>
            s.label.toLowerCase().includes(q) ||
            s.type.toLowerCase().includes(q) ||
            s.description.toLowerCase().includes(q) ||
            s.category.toLowerCase().includes(q)
        );
  if (providers !== undefined && providers.length > 0) {
    results = results.filter((s) => providers.includes(getProviderFromType(s.type)));
  }
  return results;
}
