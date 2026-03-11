# Node library provider filter icons (multi-select) — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the single-select provider filter with four icon-only toggles (AWS, GCP, Azure, Generic); selections combine (multi-select); deselecting all = show all; no "All" chip; tooltips and vendor icons.

**Architecture:** Provider filter state is a set of provider codes (no "all"). URL uses `?providers=aws,gcp`; preference stores comma-separated string. Catalog and search filter by "entry provider in set"; empty set = all. UI: four icon-only toggle buttons with `title` + `aria-label`; vendor logos for AWS/GCP/Azure (hosted SVGs), Lucide for Generic.

**Tech Stack:** Next.js, React, Zod, Effect, existing `user_preferences` table, Lucide React, Next Image for provider logos.

**Design doc:** `docs/plans/2026-02-26-node-library-provider-filter-icons-design.md`

---

## Task 1: Schema and types — provider set, remove "all"

**Files:**
- Modify: `lib/api.schemas.ts`
- Modify: `lib/types.ts`
- Test: `lib/api.schemas.test.ts`

**Step 1: Add schema for single provider (no "all") and for provider set**

In `lib/api.schemas.ts`:
- Replace `NodeLibraryProviderSchema` with `z.enum(["aws", "gcp", "azure", "generic"])` (remove `"all"`).
- Add `NodeLibraryProvidersSchema = z.array(NodeLibraryProviderSchema)` for the filter set.

**Step 2: Update types**

In `lib/types.ts`: `NodeLibraryProvider` is inferred from the new enum (no "all"). No new exported type needed for the set; use `readonly NodeLibraryProvider[]` where needed.

**Step 3: Update tests**

In `lib/api.schemas.test.ts`: Adjust tests so valid values are only `"aws" | "gcp" | "azure" | "generic"`; remove "all" from valid list; add test that `NodeLibraryProvidersSchema` accepts `["aws", "gcp"]` and rejects `["all"]` or invalid strings.

**Step 4: Run tests**

Run: `pnpm test -- lib/api.schemas.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add lib/api.schemas.ts lib/types.ts lib/api.schemas.test.ts
git commit -m "refactor(api): provider filter as set; remove 'all' from schema"
```

---

## Task 2: user_preferences — get/set provider set

**Files:**
- Modify: `lib/userPreferences.ts`
- Test: `lib/userPreferences.test.ts`

**Step 1: Parse/serialize comma-separated value**

- Add helper: `parseProvidersValue(value: string): NodeLibraryProvider[]` — split by comma, trim, safeParse each; filter to success; return deduplicated array (or use Set then Array.from). Treat `""` or `"all"` as `[]`.
- Add helper: `serializeProviders(providers: readonly NodeLibraryProvider[]): string` — `providers.join(",")` (empty array → `""`).

**Step 2: getNodeLibraryProvider → getNodeLibraryProviders**

- Rename to `getNodeLibraryProviders(client, userId)`. Return type `Effect.Effect<Option.Option<NodeLibraryProvider[]>>`. Read `value` from row; call `parseProvidersValue(value)`; return `Option.some(parsed)` if row exists and value non-null, else `Option.none()` for no row, `Option.some([])` when value is "" or "all".

**Step 3: setNodeLibraryProvider → setNodeLibraryProviders**

- Rename to `setNodeLibraryProviders(client, userId, providers: NodeLibraryProvider[])`. Serialize with `serializeProviders(providers)` and upsert that string into `user_preferences.value`.

**Step 4: Update userPreferences tests**

- Tests for `getNodeLibraryProviders`: no row → none; row with `"aws,gcp"` → some(["aws","gcp"]); row with `"all"` or `""` → some([]).
- Tests for `setNodeLibraryProviders`: set then get returns same set; empty array stored as "".

**Step 5: Run tests**

Run: `pnpm test -- lib/userPreferences.test.ts`
Expected: PASS.

**Step 6: Commit**

```bash
git add lib/userPreferences.ts lib/userPreferences.test.ts
git commit -m "feat(prefs): get/set node library providers as set (comma-separated)"
```

---

## Task 3: Catalog — filter by provider set

**Files:**
- Modify: `lib/serviceCatalog.ts`
- Test: `lib/serviceCatalog.test.ts` (if present; else add minimal tests or rely on existing)

**Step 1: getServicesByCategory(providers)**

- Change signature to `getServicesByCategory(providers: readonly NodeLibraryProvider[]): Map<...>`.
- When `providers.length === 0`, use full catalog (current "all" behavior). Otherwise filter to entries where `getProviderFromType(entry.type)` is in the set (e.g. `providers.includes(getProviderFromType(s.type))`). Keep category grouping and generic-first sort.

**Step 2: searchServices(query, providers?)**

- Add optional second param: `providers?: readonly NodeLibraryProvider[]`. When provided and length > 0, filter search results to entries whose provider is in `providers`. When absent or empty, current behavior (search all).

**Step 3: getProviderFromType**

- Return type is already `NodeLibraryProvider`; ensure it only returns "aws"|"gcp"|"azure"|"generic" (no "all"). Remove any "all" branch if present.

**Step 4: Run tests**

Run: `pnpm test -- lib/serviceCatalog.test.ts`
Expected: PASS. Add or adjust tests for empty set = all, and for set [aws] filtering.

**Step 5: Commit**

```bash
git add lib/serviceCatalog.ts lib/serviceCatalog.test.ts
git commit -m "feat(catalog): filter by provider set; empty set = all"
```

---

## Task 4: API preferences — GET/PATCH use providers array

**Files:**
- Modify: `app/api/preferences/route.ts`

**Step 1: GET**

- Call `getNodeLibraryProviders(supabase, user.id)`. Return `NextResponse.json({ providers: Option.getOrElse(providerOpt, () => []) })` so response is always `{ providers: string[] }`.

**Step 2: PATCH**

- Parse body as `{ providers?: string[] }`. Validate with `NodeLibraryProvidersSchema.safeParse(body.providers)`. If invalid, return 400 with message that each must be aws|gcp|azure|generic. Call `setNodeLibraryProviders(supabase, user.id, parsed.data)`. Return 500 on Effect failure, 200 with `{ ok: true }` on success.

**Step 3: Manual check**

- GET /api/preferences returns `{ providers: [] }` or `{ providers: ["aws"] }`; PATCH with `{ providers: ["aws","gcp"] }` succeeds.

**Step 4: Commit**

```bash
git add app/api/preferences/route.ts
git commit -m "feat(api): preferences GET/PATCH use providers array"
```

---

## Task 5: preferencesClient — fetch/save provider set

**Files:**
- Modify: `services/preferencesClient.ts`
- Test: `services/preferencesClient.test.ts`

**Step 1: fetchNodeLibraryProvider → fetchNodeLibraryProviders**

- `apiGet<{ providers?: string[] }>("/api/preferences")`. Map response to `Option.some(validated)` using `NodeLibraryProvidersSchema.safeParse(data.providers)`; if missing or invalid, `Option.none()` or `Option.some([])` per design (empty = no filter).

**Step 2: saveNodeLibraryProvider → saveNodeLibraryProviders**

- `saveNodeLibraryProviders(providers: NodeLibraryProvider[])`. PATCH body `{ providers }`. Validate with schema before sending.

**Step 3: Update preferencesClient tests**

- Mock GET returning `{ providers: ["aws","gcp"] }`; assert fetch returns Option.some(["aws","gcp"]). Mock GET returning `{}` or `{ providers: [] }`; assert fetch returns Option.some([]). Save with ["aws"] then verify PATCH was called with that body.

**Step 4: Run tests**

Run: `pnpm test -- services/preferencesClient.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add services/preferencesClient.ts services/preferencesClient.test.ts
git commit -m "feat(client): fetch/save node library providers as array"
```

---

## Task 6: Provider icons — assets and resolver

**Files:**
- Create: `public/icons/providers/` directory
- Add: AWS, GCP, Azure SVG logos (small, e.g. 24x24 or 32x32). Source: official brand icons or simple SVGs; document in `public/icons/providers/README.md`.
- Create or modify: `lib/providerIcons.ts` (or keep in component) — map provider to image path or Lucide component. Export e.g. `getProviderIcon(provider: NodeLibraryProvider): { type: 'image', src: string } | { type: 'lucide', Icon: LucideIcon }` for AWS/GCP/Azure (image), Generic (Lucide Box/Package).

**Step 1: Add provider logo assets**

- Create `public/icons/providers/README.md` noting source (e.g. AWS Architecture, GCP, Azure Architecture icons or official brand kits). Add `aws.svg`, `gcp.svg`, `azure.svg` (or equivalent filenames). For Generic we use Lucide only, no asset.

**Step 2: Provider icon resolver**

- In `lib/providerIcons.ts`: `getProviderIcon(provider)` returns either image path for aws/gcp/azure (e.g. `/icons/providers/aws.svg`) or Lucide icon component for generic. Use explicit return type so NodeLibrary can render either `<Image>` or `<Icon />`.

**Step 3: Commit**

```bash
git add public/icons/providers/ lib/providerIcons.ts
git commit -m "feat(icons): add provider logos and resolver for filter bar"
```

---

## Task 7: NodeLibrary — multi-select state, URL, and icon toggles

**Files:**
- Modify: `components/canvas/NodeLibrary.tsx`

**Step 1: URL and state**

- Use query param `providers` (not `provider`). Parse with e.g. `parseProvidersFromUrl(Option.fromNullable(searchParams.get("providers")))` → `NodeLibraryProvider[]` (split comma, validate each; invalid/missing → []).
- State: `useState<NodeLibraryProvider[]>(providerSetFromUrl)`. Sync state from URL when `providerSetFromUrl` changes (useEffect).

**Step 2: Load preference when URL has no providers**

- When `searchParams.get("providers")` is null/empty and not anonymous, fetch `fetchNodeLibraryProviders()` and set state + URL from result (Option.getOrElse(..., () => [])). When anonymous, read from localStorage key (e.g. store JSON array or comma-separated); parse and set state + URL.

**Step 3: Toggle handler**

- `toggleProvider(p: NodeLibraryProvider)`: if `p` is in state, remove it; else add it. Update state, then update URL (`providers=aws,gcp` or delete param when empty), then call `saveNodeLibraryProviders(selected)` for signed-in users (pass full array).

**Step 4: Catalog and search**

- Pass state array to `getServicesByCategory(providers)` and to search filter: `searchServices(query, providers)` (or filter search results by provider set when providers.length > 0).

**Step 5: Render four icon-only toggles**

- Options array: `[{ value: "aws", label: "AWS" }, { value: "gcp", label: "GCP" }, { value: "azure", label: "Azure" }, { value: "generic", label: "Generic" }]` (no "all").
- For each, render a button: `onClick={() => toggleProvider(opt.value)}`, `className` selected when `providers.includes(opt.value)`. Content: render icon from `getProviderIcon(opt.value)` (Image for aws/gcp/azure, Lucide for generic). `title={opt.label}`, `aria-label={opt.label}`.

**Step 6: Backward compatibility**

- If URL has `provider` (singular) and not `providers`, parse once: "all" or missing → []; else [parsed value]. Then replace URL with `providers=...` so next time we use plural. Same for stored preference "all" (already handled in getNodeLibraryProviders).

**Step 7: Manual test**

- Open app, confirm four icon toggles; select AWS only → list filters to AWS; add GCP → list shows AWS + GCP; deselect all → list shows all. Reload with ?providers=aws,gcp → same. Signed-in: change toggles, reload → preference restored.

**Step 8: Commit**

```bash
git add components/canvas/NodeLibrary.tsx
git commit -m "feat(ui): provider filter as icon toggles (multi-select, tooltips)"
```

---

## Task 8: Fix call sites and references to old provider API

**Files:**
- Grep for `NodeLibraryProvider` and `provider` (single), `getNodeLibraryProvider`, `setNodeLibraryProvider`, `fetchNodeLibraryProvider`, `saveNodeLibraryProvider`, `parseProviderFromUrl`, PROVIDER_OPTIONS with "all", and update any remaining references (e.g. docs, tests that mock preferences). Ensure no remaining "all" in schema or types used by filter.

**Step 1: Search and update**

- `lib/chatHelpers.test.ts` / `app/api/chat/route.test.ts`: if they reference provider preference, update to providers array or remove.
- `docs/plans/2026-02-26-node-library-provider-filter-icons-design.md`: already correct.
- Any other files referencing single provider or "all".

**Step 2: Run full test suite and lint**

Run: `pnpm test` and `pnpm lint`
Expected: PASS, no warnings.

**Step 3: Commit**

```bash
git add [affected files]
git commit -m "chore: fix references to provider filter API (set, no all)"
```

---

## Execution handoff

Plan complete and saved to `docs/plans/2026-02-26-node-library-provider-filter-icons-implementation.md` (after rename). Two execution options:

1. **Subagent-driven (this session)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Parallel session (separate)** — Open a new session with executing-plans and run through the plan with checkpoints.

Which approach do you prefer?
