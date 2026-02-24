# Node Library Providers and Filter — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add company filter (All | AWS | GCP | Azure | Generic) to the node library with URL + server preference persistence, refactor icon resolution by provider prefix, and add Azure (and optional AWS) nodes with icons.

**Architecture:** New `user_preferences` table for server-stored filter; URL query `provider=` as source of truth when present. Single icon resolver dispatches by type prefix. Catalog accepts optional provider filter; NodeLibrary shows provider chips and syncs URL + preference.

**Tech Stack:** Next.js App Router, Supabase (RLS, table), React state + URL (useSearchParams), existing icon modules (AWS/GCP/generic + new Azure).

**Design doc:** `docs/plans/2026-02-24-node-library-providers-and-filter-design.md`

---

## Task 1: Migration — user_preferences table

**Files:**
- Create: `supabase/migrations/20260224115726_user_preferences.sql`

**Step 1: Add migration**

Create migration with:
- Table `public.user_preferences` with columns: `user_id` uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, `key` text NOT NULL, `value` text NOT NULL, `updated_at` timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (user_id, key).
- RLS enabled; policies: users can SELECT/INSERT/UPDATE only where `auth.uid() = user_id`. No DELETE policy needed (optional: allow delete own row for key).
- Index on (user_id) if desired (PK already covers lookups by user_id + key).

**Step 2: Run migration**

Run: `pnpm supabase db push` or apply via your workflow.
Expected: Migration applies without errors.

**Step 3: Commit**

```bash
git add supabase/migrations/20260224115726_user_preferences.sql
git commit -m "feat(db): add user_preferences table and RLS"
```

---

## Task 2: Types for provider and preference key

**Files:**
- Create or modify: `lib/types.ts` (or add to existing types file used by app)

**Step 1: Add types**

Define:
- `NodeLibraryProvider = 'all' | 'aws' | 'gcp' | 'azure' | 'generic'`.
- Constant for preference key: `NODE_LIBRARY_PROVIDER_KEY = 'node_library_provider'`.
- Type for stored preference value: same as NodeLibraryProvider minus 'all' if you store only when not 'all', or store 'all' too (recommended: store as-is so URL and DB stay in sync).

**Step 2: Export and use in one call site**

Ensure the type is used (e.g. in a function that will read/write preference). No new tests required if types are trivial.

**Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "feat(types): add NodeLibraryProvider and preference key"
```

---

## Task 3: Supabase client — read and upsert user preference

**Files:**
- Create: `lib/userPreferences.ts` (or `services/userPreferences.ts`)
- Test: `lib/userPreferences.test.ts`

**Step 1: Write failing tests**

- Test: `getNodeLibraryProvider(supabaseClient, userId)` returns stored value when row exists; returns `null` when no row.
- Test: `setNodeLibraryProvider(supabaseClient, userId, 'aws')` upserts row and subsequent get returns `'aws'`. Use a test Supabase client or mock.

If using Supabase local + test user, implement tests that run against local DB. Otherwise use mocks for `supabase.from('user_preferences').select().eq(...)` and `.upsert(...)`.

**Step 2: Run tests**

Run: `pnpm test -- lib/userPreferences.test.ts`
Expected: FAIL (functions not implemented).

**Step 3: Implement**

- `getNodeLibraryProvider(client, userId): Promise<NodeLibraryProvider | null>`: select `value` from `user_preferences` where `user_id = userId` and `key = NODE_LIBRARY_PROVIDER_KEY`; return first row's value cast to NodeLibraryProvider or null.
- `setNodeLibraryProvider(client, userId, value): Promise<Result<void, Error>>`: upsert `{ user_id: userId, key: NODE_LIBRARY_PROVIDER_KEY, value, updated_at: new Date().toISOString() }` with `onConflict: 'user_id,key'`. Return ok() or err from neverthrow.

**Step 4: Run tests**

Run: `pnpm test -- lib/userPreferences.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add lib/userPreferences.ts lib/userPreferences.test.ts
git commit -m "feat(prefs): read/upsert node library provider preference"
```

---

## Task 4: Catalog — provider filter and getProviderFromType

**Files:**
- Modify: `lib/serviceCatalog.ts`
- Test: `lib/serviceCatalog.test.ts` (create if missing)

**Step 1: Write failing tests**

- Test: `getProviderFromType('awsLambda') === 'aws'`, `getProviderFromType('gcpGke') === 'gcp'`, `getProviderFromType('genericNosql') === 'generic'`, `getProviderFromType('text')` → decide: return 'generic' or a separate 'notes' bucket; design says generic is its own option so 'text' can map to 'generic' or a special case that stays in "All" and "Generic" only.
- Test: `getServicesByCategory('aws')` returns only entries with type starting with `aws`; same for `gcp`, `generic`; `getServicesByCategory('all')` returns same as current getServicesByCategory().

**Step 2: Run tests**

Run: `pnpm test -- lib/serviceCatalog.test.ts`
Expected: FAIL.

**Step 3: Implement**

- Add `getProviderFromType(type: string): NodeLibraryProvider | 'all'`: if type.startsWith('aws') return 'aws'; gcp → 'gcp'; azure → 'azure'; generic → 'generic'; else (e.g. 'text') return 'generic'.
- Change `getServicesByCategory(provider?: NodeLibraryProvider): Map<ServiceCategory, ServiceEntry[]>`: when provider is 'all' or undefined, keep current behavior; otherwise filter SERVICE_CATALOG to entries where getProviderFromType(entry.type) === provider, then build map and sort (generic first within category). Export NodeLibraryProvider from types or re-export from catalog.

**Step 4: Run tests**

Run: `pnpm test -- lib/serviceCatalog.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add lib/serviceCatalog.ts lib/serviceCatalog.test.ts
git commit -m "feat(catalog): provider filter and getProviderFromType"
```

---

## Task 5: Icon resolver — single helper by prefix

**Files:**
- Create: `lib/nodeIconResolver.ts`
- Modify: `components/canvas/NodeLibrary.tsx`, `components/canvas/nodes/AwsNode.tsx`
- Test: `lib/nodeIconResolver.test.ts`

**Step 1: Write failing tests**

- Test: for type `awsLambda` resolver returns same URL as getAwsIconUrl('awsLambda'); for `gcpGke` same as getGcpIconUrl; for `genericNosql` returns null for URL but component from getGenericIcon; for unknown type returns null. Add test for `getNodeIconUrl(type)` and `getNodeIconComponent(type)` (or single API that returns { url, component }).

**Step 2: Run tests**

Run: `pnpm test -- lib/nodeIconResolver.test.ts`
Expected: FAIL.

**Step 3: Implement**

- `getNodeIconUrl(type: string): string | null`: if type.startsWith('aws') return getAwsIconUrl(type); if 'gcp' return getGcpIconUrl(type); if 'azure' return getAzureIconUrl(type) (implement in next task; for now stub returning null); if 'generic' return null; else null.
- `getNodeIconComponent(type: string): LucideIcon | null`: if type.startsWith('generic') return getGenericIcon(type); else null. Used when URL is null.
- Use these in NodeLibrary and AwsNode: iconUrl = getNodeIconUrl(type); GenericIcon = getNodeIconComponent(type); remove direct getAwsIconUrl/getGcpIconUrl/getGenericIcon from NodeLibrary and AwsNode.

**Step 4: Run tests**

Run: `pnpm test -- lib/nodeIconResolver.test.ts`
Expected: PASS (Azure stub returns null).

**Step 5: Commit**

```bash
git add lib/nodeIconResolver.ts lib/nodeIconResolver.test.ts components/canvas/NodeLibrary.tsx components/canvas/nodes/AwsNode.tsx
git commit -m "refactor(icons): resolve by provider prefix in nodeIconResolver"
```

---

## Task 6: Azure icons and catalog entries

**Files:**
- Create: `lib/azureNodeIcons.ts`, `public/icons/azure/README.md`
- Create: Add Azure SVGs under `public/icons/azure/` (e.g. from Azure Architecture Center; document in README)
- Modify: `lib/serviceCatalog.ts` (add Azure entries), `lib/nodeIconResolver.ts` (call getAzureIconUrl)
- Test: `lib/azureNodeIcons.test.ts`, update `lib/nodeIconResolver.test.ts`

**Step 1: Add Azure SVG assets and README**

Download or copy Azure Architecture Center icons (SVG) for: Functions, Cosmos DB, Blob Storage, Service Bus, Event Hub, Key Vault, etc. Place in `public/icons/azure/`. Add README with source URL and license.

**Step 2: Implement azureNodeIcons.ts**

- Map type string (e.g. `azureFunctions`) to filename (e.g. `Azure-Functions.svg`). Implement `getAzureIconUrl(type): string | null` and `isAzureNodeType(type): boolean`.

**Step 3: Add Azure entries to SERVICE_CATALOG**

Add entries with type `azure*`, appropriate category and labels (e.g. azureFunctions, azureCosmosDb, azureBlobStorage, azureServiceBus, azureEventHubs, azureKeyVault). Keep category order and generic-first ordering in mind.

**Step 4: Wire Azure into nodeIconResolver**

In getNodeIconUrl, when type.startsWith('azure') return getAzureIconUrl(type). Add test cases for one Azure type.

**Step 5: Run tests and lint**

Run: `pnpm test -- lib/azureNodeIcons.test.ts lib/nodeIconResolver.test.ts` and `pnpm lint`
Expected: PASS.

**Step 6: Commit**

```bash
git add lib/azureNodeIcons.ts lib/azureNodeIcons.test.ts lib/serviceCatalog.ts lib/nodeIconResolver.ts lib/nodeIconResolver.test.ts public/icons/azure/
git commit -m "feat(icons): Azure provider and catalog entries"
```

---

## Task 7: NodeLibrary — provider filter UI and URL sync

**Files:**
- Modify: `components/canvas/NodeLibrary.tsx`
- Possibly: Create `app/canvas/page.tsx` or layout that has searchParams (or use useSearchParams in parent and pass provider down)

**Step 1: Add provider state from URL + preference**

- Use `useSearchParams()` to read `provider` query param. Parse to NodeLibraryProvider; invalid or missing → treat as 'all'.
- If you have auth and want server preference: on mount, fetch `getNodeLibraryProvider(client, user.id)`; when URL has no `provider`, set URL (or initial state) from fetched value. Optional: use a small hook `useNodeLibraryProvider()` that returns [provider, setProvider] and syncs URL + server.
- Default: when no URL param and no stored preference, use 'all'.

**Step 2: Add filter UI**

- Above the search bar, render a row of chips or buttons: All, AWS, GCP, Azure, Generic. Highlight active provider. On click: set URL (replace searchParams with `?provider=aws` etc.), call setNodeLibraryProvider if authenticated, and update local state so list re-renders.

**Step 3: Use filtered catalog**

- When not searching: call `getServicesByCategory(provider)` and render category groups from that. When searching: filter `searchServices(query)` by provider (add optional provider param to searchServices, or filter result by getProviderFromType) so results match selected provider.

**Step 4: Manual test**

Open app, change filter, reload; confirm URL and (when logged in) that preference persists. Confirm list shows only selected provider's nodes.

**Step 5: Commit**

```bash
git add components/canvas/NodeLibrary.tsx
git commit -m "feat(ui): node library company filter with URL and preference sync"
```

---

## Task 8: Preference load/save from client (API or server action)

**Files:**
- Create: Route or server action that uses Supabase server client to read/update preference (e.g. `app/api/preferences/route.ts` or `app/actions/preferences.ts`)
- Modify: NodeLibrary or its parent to call this when authenticated

**Step 1: Implement server path**

- GET: return `{ provider: string | null }` for current user (getUser(), then getNodeLibraryProvider(serverSupabase, user.id)).
- POST or PATCH: body `{ provider: NodeLibraryProvider }`; validate with Zod; upsert via setNodeLibraryProvider. Return 401 if not authenticated.

**Step 2: Call from client**

- On load: if URL has no `provider`, fetch GET preferences and set initial provider from response.
- On filter change: update URL, then POST preference with new value. Use try/catch or Result; no need to block UI on save failure.

**Step 3: Commit**

```bash
git add app/api/preferences/route.ts app/actions/preferences.ts components/canvas/NodeLibrary.tsx
git commit -m "feat(api): preferences API and wire to node library filter"
```

---

## Task 9: Optional — add missing AWS nodes

**Files:**
- Modify: `lib/serviceCatalog.ts`, `lib/awsNodeIcons.ts` (if new icons needed)
- Add icons if not using CDN: `public/icons/aws/` or keep CDN URLs in awsNodeIcons

**Step 1: Add entries**

Add high-value system design nodes if missing: e.g. DocumentDB, Neptune, OpenSearch, Lambda@Edge. Reuse existing AWS icon mapping or add new mappings in awsNodeIcons (CDN or local). Keep list minimal.

**Step 2: Commit**

```bash
git add lib/serviceCatalog.ts lib/awsNodeIcons.ts
git commit -m "feat(catalog): add missing AWS nodes for system design"
```

---

## Task 10: Tests and lint

**Files:**
- All test files touched above; `package.json` scripts

**Step 1: Run full test suite**

Run: `pnpm test`
Expected: All pass.

**Step 2: Run lint and typecheck**

Run: `pnpm lint` and `pnpm tsc --noEmit`
Expected: No errors.

**Step 3: Commit if any test/lint fixes**

```bash
git add ...
git commit -m "test: fix node library and preference tests"
```

---

## Execution options

Plan complete and saved to `docs/plans/2026-02-24-node-library-providers-and-filter-implementation.md`.

**Two execution options:**

1. **Subagent-driven (this session)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Parallel session (separate)** — Open a new session with executing-plans and run through the plan with checkpoints.

Which approach do you want?
