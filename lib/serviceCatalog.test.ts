import { describe, it, expect } from "vitest";
import {
  SERVICE_CATALOG,
  CATEGORY_ORDER,
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
});

describe("getServicesByCategory", () => {
  it("returns a Map with every category", () => {
    const map = getServicesByCategory();
    for (const cat of CATEGORY_ORDER) {
      expect(map.has(cat)).toBe(true);
    }
  });

  it("total entries equals catalog size", () => {
    const map = getServicesByCategory();
    let total = 0;
    for (const list of map.values()) total += list.length;
    expect(total).toBe(SERVICE_CATALOG.length);
  });

  it("groups services correctly", () => {
    const map = getServicesByCategory();
    const compute = map.get("compute")!;
    expect(compute.some((s) => s.type === "ec2")).toBe(true);
    expect(compute.some((s) => s.type === "lambda")).toBe(true);
  });
});

describe("searchServices", () => {
  it("returns all services for empty query", () => {
    expect(searchServices("")).toHaveLength(SERVICE_CATALOG.length);
    expect(searchServices("  ")).toHaveLength(SERVICE_CATALOG.length);
  });

  it("finds by label", () => {
    const results = searchServices("Lambda");
    expect(results.some((s) => s.type === "lambda")).toBe(true);
  });

  it("finds by description keyword", () => {
    const results = searchServices("message");
    expect(results.some((s) => s.type === "sqs")).toBe(true);
  });

  it("finds by category", () => {
    const results = searchServices("storage");
    expect(results.some((s) => s.type === "s3")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(searchServices("dynamodb")).toEqual(searchServices("DynamoDB"));
  });

  it("returns empty for no match", () => {
    expect(searchServices("xyznonexistent")).toHaveLength(0);
  });
});
