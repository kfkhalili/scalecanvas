import { describe, it, expect } from "vitest";
import {
  SERVICE_CATALOG,
  CATEGORY_ORDER,
  getProviderFromType,
  getServicesByCategory,
  searchServices,
} from "./serviceCatalog";

describe("SERVICE_CATALOG", () => {
  it("has no duplicate types", () => {
    const types = SERVICE_CATALOG.map((s) => s.type);
    expect(new Set(types).size).toBe(types.length);
  });

  it("every entry has non-empty label and description", () => {
    for (const s of SERVICE_CATALOG) {
      expect(s.label.length).toBeGreaterThan(0);
      expect(s.description.length).toBeGreaterThan(0);
    }
  });

  it("every category in catalog is in CATEGORY_ORDER", () => {
    const ordered = new Set(CATEGORY_ORDER);
    for (const s of SERVICE_CATALOG) {
      expect(ordered.has(s.category)).toBe(true);
    }
  });

  it("has a text entry in notes category for canvas text nodes", () => {
    const textEntry = SERVICE_CATALOG.find((s) => s.type === "text");
    expect(textEntry).toBeDefined();
    expect(textEntry!.category).toBe("notes");
    expect(textEntry!.label).toBe("Text");
  });

  it("has generic (brandless) entries under correct categories", () => {
    const nosql = SERVICE_CATALOG.find((s) => s.type === "genericNosql");
    expect(nosql).toBeDefined();
    expect(nosql!.label).toBe("NoSQL DB");
    expect(nosql!.category).toBe("database");
    const api = SERVICE_CATALOG.find((s) => s.type === "genericApi");
    expect(api).toBeDefined();
    expect(api!.category).toBe("networking");
  });

  it("sorts generic entries to top of each category in getServicesByCategory", () => {
    const map = getServicesByCategory([]);
    const database = map.get("database")!;
    expect(database[0].type).toBe("genericNosql");
    const networking = map.get("networking")!;
    expect(networking[0].type).toBe("genericApi");
    const integration = map.get("integration")!;
    expect(integration[0].type).toBe("genericQueue");
    const compute = map.get("compute")!;
    expect(compute[0].type).toBe("genericServerless");
  });

  it("has GCP entries under correct categories", () => {
    const gcpEntries = SERVICE_CATALOG.filter((s) => s.type.startsWith("gcp"));
    expect(gcpEntries.length).toBeGreaterThanOrEqual(1);
    const cloudRun = SERVICE_CATALOG.find((s) => s.type === "gcpCloudRun");
    expect(cloudRun).toBeDefined();
    expect(cloudRun!.category).toBe("compute");
    const ordered = new Set(CATEGORY_ORDER);
    for (const s of gcpEntries) {
      expect(ordered.has(s.category)).toBe(true);
    }
  });
});

describe("getProviderFromType", () => {
  it("returns aws for aws-prefixed types", () => {
    expect(getProviderFromType("awsLambda")).toBe("aws");
    expect(getProviderFromType("awsS3")).toBe("aws");
  });

  it("returns gcp for gcp-prefixed types", () => {
    expect(getProviderFromType("gcpGke")).toBe("gcp");
    expect(getProviderFromType("gcpCloudRun")).toBe("gcp");
  });

  it("returns generic for generic-prefixed types", () => {
    expect(getProviderFromType("genericNosql")).toBe("generic");
    expect(getProviderFromType("genericApi")).toBe("generic");
  });

  it("returns generic for text (notes)", () => {
    expect(getProviderFromType("text")).toBe("generic");
  });
});

describe("getServicesByCategory", () => {
  it("returns a Map with every category", () => {
    const map = getServicesByCategory([]);
    for (const cat of CATEGORY_ORDER) {
      expect(map.has(cat)).toBe(true);
    }
  });

  it("getServicesByCategory([]) returns full catalog", () => {
    const map = getServicesByCategory([]);
    let total = 0;
    for (const list of map.values()) total += list.length;
    expect(total).toBe(SERVICE_CATALOG.length);
  });

  it("getServicesByCategory(['aws']) returns only aws entries", () => {
    const map = getServicesByCategory(["aws"]);
    let total = 0;
    for (const list of map.values()) {
      for (const s of list) {
        expect(s.type.startsWith("aws")).toBe(true);
        total += 1;
      }
    }
    expect(total).toBeGreaterThan(0);
    expect(total).toBe(SERVICE_CATALOG.filter((s) => s.type.startsWith("aws")).length);
  });

  it("getServicesByCategory(['gcp']) returns only gcp entries", () => {
    const map = getServicesByCategory(["gcp"]);
    let total = 0;
    for (const list of map.values()) {
      for (const s of list) {
        expect(s.type.startsWith("gcp")).toBe(true);
        total += 1;
      }
    }
    expect(total).toBe(SERVICE_CATALOG.filter((s) => s.type.startsWith("gcp")).length);
  });

  it("getServicesByCategory(['azure']) returns only azure entries", () => {
    const map = getServicesByCategory(["azure"]);
    let total = 0;
    for (const list of map.values()) {
      for (const s of list) {
        expect(s.type.startsWith("azure")).toBe(true);
        total += 1;
      }
    }
    expect(total).toBe(SERVICE_CATALOG.filter((s) => s.type.startsWith("azure")).length);
  });

  it("getServicesByCategory(['generic']) returns only generic and text entries", () => {
    const map = getServicesByCategory(["generic"]);
    const genericOrText = (t: string) => t.startsWith("generic") || t === "text";
    let total = 0;
    for (const list of map.values()) {
      for (const s of list) {
        expect(genericOrText(s.type)).toBe(true);
        total += 1;
      }
    }
    expect(total).toBe(
      SERVICE_CATALOG.filter((s) => genericOrText(s.type)).length
    );
  });

  it("getServicesByCategory(['aws', 'gcp']) returns only aws and gcp entries", () => {
    const map = getServicesByCategory(["aws", "gcp"]);
    const awsCount = SERVICE_CATALOG.filter((s) => s.type.startsWith("aws")).length;
    const gcpCount = SERVICE_CATALOG.filter((s) => s.type.startsWith("gcp")).length;
    let total = 0;
    for (const list of map.values()) {
      for (const s of list) {
        expect(s.type.startsWith("aws") || s.type.startsWith("gcp")).toBe(true);
        total += 1;
      }
    }
    expect(total).toBe(awsCount + gcpCount);
  });

  it("groups services correctly", () => {
    const map = getServicesByCategory([]);
    const compute = map.get("compute")!;
    expect(compute.some((s) => s.type === "awsEc2")).toBe(true);
    expect(compute.some((s) => s.type === "awsLambda")).toBe(true);
  });
});

describe("searchServices", () => {
  it("returns all services for empty query", () => {
    expect(searchServices("")).toHaveLength(SERVICE_CATALOG.length);
    expect(searchServices("  ")).toHaveLength(SERVICE_CATALOG.length);
  });

  it("finds by label", () => {
    const results = searchServices("Lambda");
    expect(results.some((s) => s.type === "awsLambda")).toBe(true);
  });

  it("finds by description keyword", () => {
    const results = searchServices("message");
    expect(results.some((s) => s.type === "awsSqs")).toBe(true);
  });

  it("finds by category", () => {
    const results = searchServices("storage");
    expect(results.some((s) => s.type === "awsS3")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(searchServices("dynamodb")).toEqual(searchServices("DynamoDB"));
  });

  it("returns empty for no match", () => {
    expect(searchServices("xyznonexistent")).toHaveLength(0);
  });

  it("searchServices('lambda', ['aws']) returns only AWS entries", () => {
    const results = searchServices("lambda", ["aws"]);
    expect(results.length).toBeGreaterThan(0);
    for (const s of results) {
      expect(s.type.startsWith("aws")).toBe(true);
    }
    expect(results.some((s) => s.type === "awsLambda")).toBe(true);
  });

  it("searchServices('lambda', []) returns all matches", () => {
    const withFilter = searchServices("lambda", []);
    const withoutFilter = searchServices("lambda");
    expect(withFilter).toEqual(withoutFilter);
    expect(withFilter.some((s) => s.type === "awsLambda")).toBe(true);
  });
});
