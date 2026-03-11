# Node library: more providers, company filter, icon resolution, preference persistence

## Summary

- Add missing AWS nodes for system design; add Azure as a provider with hosted SVGs; keep generic.
- Company filter at top of library: All | AWS | GCP | Azure | Generic (each exclusive; Generic is its own option).
- Icon resolution by type prefix (one getter per provider), not a chain.
- Filter preference: URL as source of truth when present; server-stored in dedicated `user_preferences` table for cross-device "remember"; default All for new users.

---

## 1. Scope and goals

- **Coverage:** Support system design interview diagrams with AWS, GCP, Azure, and generic (brandless) nodes. Add any high-value AWS nodes we lack; add Azure services and official icons.
- **Discovery:** Let users filter the node library by provider (All / AWS / GCP / Azure / Generic) so lists stay manageable.
- **Consistency:** Resolve node icons by provider prefix (e.g. `aws*` → AWS, `gcp*` → GCP, `azure*` → Azure, `generic*` → Lucide), not by trying providers in sequence.
- **Remember choice:** Default to "All" for new users; remember last filter across sessions and devices via URL + server-stored preference.

---

## 2. Provider filter

- **Options:** All | AWS | GCP | Azure | Generic. Only one active; Generic is its own option (selecting AWS does not include Generic).
- **Default for new users:** All (no param, no stored preference).
- **Persistence (SOTA):**
  - **URL:** When user changes filter, set query param (e.g. `?provider=aws`). URL is source of truth when present (shareable, back/forward).
  - **Server:** Store in `user_preferences` (see below). Load after auth; use as fallback when URL has no `provider`. On filter change: update URL and upsert preference so it follows the user across devices.
  - **Optional:** localStorage as fallback before prefs load or for anonymous (if we ever show the library when not logged in).

---

## 3. Server: user_preferences table

- **Table:** `user_preferences`
  - `user_id` uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
  - `key` text NOT NULL (e.g. `node_library_provider`)
  - `value` text (or jsonb if we ever need structured values)
  - `updated_at` timestamptz NOT NULL DEFAULT now()
  - PRIMARY KEY (user_id, key)
- **RLS:** Users can SELECT/INSERT/UPDATE only their own rows.
- **Usage:** One row per preference key. For this feature, key = `node_library_provider`, value = `all` | `aws` | `gcp` | `azure` | `generic`. Extensible for future prefs without new columns.

---

## 4. Icon resolution

- **Current (remove):** Chain `getAwsIconUrl(type) ?? getGcpIconUrl(type)` then generic.
- **New:** Dispatch by type prefix; call exactly one getter:
  - `type.startsWith('aws')` → getAwsIconUrl(type)
  - `type.startsWith('gcp')` → getGcpIconUrl(type)
  - `type.startsWith('azure')` → getAzureIconUrl(type) (new)
  - `type.startsWith('generic')` → getGenericIcon(type)
  - else → null (or generic fallback if desired)
- Centralize in a small helper (e.g. `getNodeIcon(type)`) used by AwsNode and NodeLibrary so all call sites stay consistent.

---

## 5. Catalog and providers

- **Catalog:** Keep single `SERVICE_CATALOG`; each entry has `type` (e.g. `awsLambda`, `gcpCloudRun`, `azureFunctions`). No schema change to entries; add a derived "provider" for filtering (from type prefix).
- **Filtering:** `getServicesByCategory()` (or equivalent) accepts optional `provider?: 'all' | 'aws' | 'gcp' | 'azure' | 'generic'`. When set, filter catalog to types that match that provider before grouping by category. Generic types sort first within category (existing behavior).
- **AWS:** Add any missing nodes commonly needed in system design (e.g. DocumentDB, Neptune, OpenSearch, Lambda@Edge, if we have icons and they add value). Minimal set; avoid bloat.
- **Azure:** Add Azure as a provider: `azure*` types, Azure catalog entries (Functions, Cosmos DB, Blob Storage, Service Bus, etc.), SVGs under `public/icons/azure/` from official [Azure Architecture Center icons](https://learn.microsoft.com/en-us/azure/architecture/icons/) (download and host; same pattern as GCP). Document source in `public/icons/azure/README.md`.

---

## 6. Node library UI

- **Placement:** Company filter above the search bar (e.g. horizontal row of provider chips or icons: All, AWS, GCP, Azure, Generic). Selected state visually clear; click to set filter and update URL + server preference.
- **Behavior:** When filter is not All, list shows only nodes for that provider (still grouped by category, generic-first within category when provider is Generic). Search continues to work over the full catalog or the filtered subset (consistent either way; recommend search over filtered subset).
- **Initial state:** Read `provider` from URL; if absent, read from `user_preferences` (after auth); if absent, use `all`. Optional: read from localStorage while prefs are loading.

---

## 7. API / data flow

- **Load preference:** After auth, client fetches `user_preferences` for current user (or an API that returns prefs including `node_library_provider`). Use to set initial filter when URL has no `provider`.
- **Save preference:** When user changes filter, client (1) updates URL (e.g. `router.replace` with `?provider=aws`), (2) calls API or Supabase to upsert `user_preferences` (user_id, `node_library_provider`, value). Authenticated only; no-op or skip for anonymous if library is ever shown then.

---

## 8. Out of scope for this design

- Migrating existing canvas data (e.g. old node types); that can be a separate migration or doc.
- Other UI preferences (theme, sidebar width) unless we add them to `user_preferences` with the same pattern.

---

## 9. Success criteria

- Users can filter the node library by All / AWS / GCP / Azure / Generic.
- New users see All by default; returning users see their last choice (from URL or server).
- Preference persists across devices after login.
- Icons resolve by provider prefix from a single helper; Azure and existing providers work the same way.
- Azure nodes available with official icons; AWS coverage sufficient for typical system design sessions.
