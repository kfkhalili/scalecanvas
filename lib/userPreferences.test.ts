import { Effect, Option } from "effect";
import { describe, it, expect, vi } from "vitest";
import {
  getNodeLibraryProviders,
  setNodeLibraryProviders,
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

describe("getNodeLibraryProviders", () => {
  it("returns None when no row exists", async () => {
    const client = mockPrefsClient({ maybeSingle: { data: null, error: null } });
    const option = await Effect.runPromise(
      getNodeLibraryProviders(client, "user-1")
    );
    expect(Option.isNone(option)).toBe(true);
  });

  it('returns Some(["aws","gcp"]) when row has value "aws,gcp"', async () => {
    const client = mockPrefsClient({
      maybeSingle: { data: { value: "aws,gcp" }, error: null },
    });
    const option = await Effect.runPromise(
      getNodeLibraryProviders(client, "user-1")
    );
    expect(Option.getOrNull(option)).toEqual(["aws", "gcp"]);
  });

  it('returns Some([]) when row has value "all" or ""', async () => {
    const clientAll = mockPrefsClient({
      maybeSingle: { data: { value: "all" }, error: null },
    });
    const optionAll = await Effect.runPromise(
      getNodeLibraryProviders(clientAll, "user-1")
    );
    expect(Option.getOrNull(optionAll)).toEqual([]);

    const clientEmpty = mockPrefsClient({
      maybeSingle: { data: { value: "" }, error: null },
    });
    const optionEmpty = await Effect.runPromise(
      getNodeLibraryProviders(clientEmpty, "user-1")
    );
    expect(Option.getOrNull(optionEmpty)).toEqual([]);
  });
});

describe("setNodeLibraryProviders", () => {
  it("set then get returns same array", async () => {
    const storedRef = {
      value: null as string | null,
    };
    const selectChain = {
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockImplementation(() =>
            Promise.resolve({
              data:
                storedRef.value !== null
                  ? { value: storedRef.value }
                  : null,
              error: null,
            })
          ),
        }),
      }),
    };
    const chain = {
      select: vi.fn().mockReturnValue(selectChain),
      upsert: vi.fn().mockImplementation((row: { value: string }) => {
        storedRef.value = row.value;
        return Promise.resolve({ error: null });
      }),
    };
    const client = {
      from: vi.fn().mockReturnValue(chain),
    } as unknown as ServerSupabaseClient;

    const providers: NodeLibraryProvider[] = ["aws", "gcp"];
    await Effect.runPromise(
      setNodeLibraryProviders(client, "user-1", providers)
    );

    const getOption = await Effect.runPromise(
      getNodeLibraryProviders(client, "user-1")
    );
    expect(Option.getOrNull(getOption)).toEqual(providers);
  });

  it("empty array stored as \"\" and get returns Some([])", async () => {
    const storedRef = {
      value: null as string | null,
    };
    const selectChain = {
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockImplementation(() =>
            Promise.resolve({
              data:
                storedRef.value !== null
                  ? { value: storedRef.value }
                  : null,
              error: null,
            })
          ),
        }),
      }),
    };
    const chain = {
      select: vi.fn().mockReturnValue(selectChain),
      upsert: vi.fn().mockImplementation((row: { value: string }) => {
        storedRef.value = row.value;
        return Promise.resolve({ error: null });
      }),
    };
    const client = {
      from: vi.fn().mockReturnValue(chain),
    } as unknown as ServerSupabaseClient;

    await Effect.runPromise(
      setNodeLibraryProviders(client, "user-1", [])
    );
    expect(storedRef.value).toBe("");

    const getOption = await Effect.runPromise(
      getNodeLibraryProviders(client, "user-1")
    );
    expect(Option.getOrNull(getOption)).toEqual([]);
  });
});
