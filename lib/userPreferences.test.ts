import { describe, it, expect, vi } from "vitest";
import {
  getNodeLibraryProvider,
  setNodeLibraryProvider,
} from "./userPreferences";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import type { NodeLibraryProvider } from "@/lib/types";

function mockPrefsClient(overrides: {
  maybeSingle?: { data: { value: string } | null; error: { message: string } | null };
  upsert?: { error: { message: string } | null };
} = {}): ServerSupabaseClient {
  const maybeSingle = overrides.maybeSingle ?? { data: null, error: null };
  const upsertResult = overrides.upsert ?? { error: null };
  const chain = {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue(maybeSingle),
        }),
      }),
    }),
    upsert: vi.fn().mockResolvedValue(upsertResult),
  };
  const from = vi.fn().mockReturnValue(chain);
  return { from } as unknown as ServerSupabaseClient;
}

describe("getNodeLibraryProvider", () => {
  it("returns null when no row exists", async () => {
    const client = mockPrefsClient({ maybeSingle: { data: null, error: null } });
    const result = await getNodeLibraryProvider(client, "user-1");
    expect(result).toBeNull();
  });

  it("returns stored value when row exists", async () => {
    const client = mockPrefsClient({
      maybeSingle: { data: { value: "aws" }, error: null },
    });
    const result = await getNodeLibraryProvider(client, "user-1");
    expect(result).toBe("aws");
  });
});

describe("setNodeLibraryProvider", () => {
  it("upserts row and subsequent get returns value", async () => {
    let stored: NodeLibraryProvider | null = null;
    const selectChain = {
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockImplementation(() =>
            Promise.resolve({ data: stored ? { value: stored } : null, error: null })
          ),
        }),
      }),
    };
    const chain = {
      select: vi.fn().mockReturnValue(selectChain),
      upsert: vi.fn().mockImplementation((row: { value: string }) => {
        stored = row.value as NodeLibraryProvider;
        return Promise.resolve({ error: null });
      }),
    };
    const client = {
      from: vi.fn().mockReturnValue(chain),
    } as unknown as ServerSupabaseClient;

    const setResult = await setNodeLibraryProvider(client, "user-1", "aws");
    expect(setResult.isOk()).toBe(true);

    const getResult = await getNodeLibraryProvider(client, "user-1");
    expect(getResult).toBe("aws");
  });
});
