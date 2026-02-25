import { Effect, Option } from "effect";
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
  it("returns None when no row exists", async () => {
    const client = mockPrefsClient({ maybeSingle: { data: null, error: null } });
    const option = await Effect.runPromise(
      getNodeLibraryProvider(client, "user-1")
    );
    expect(Option.isNone(option)).toBe(true);
  });

  it("returns Some(stored value) when row exists", async () => {
    const client = mockPrefsClient({
      maybeSingle: { data: { value: "aws" }, error: null },
    });
    const option = await Effect.runPromise(
      getNodeLibraryProvider(client, "user-1")
    );
    expect(Option.getOrNull(option)).toBe("aws");
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

    await Effect.runPromise(
      setNodeLibraryProvider(client, "user-1", "aws")
    );

    const getOption = await Effect.runPromise(
      getNodeLibraryProvider(client, "user-1")
    );
    expect(Option.getOrNull(getOption)).toBe("aws");
  });
});
