# Node library: provider filter as icon toggles (multi-select)

## Summary

- Replace the current single-select provider filter (All | AWS | GCP | Azure | Generic) with **four icon-only toggles**: AWS, GCP, Azure, Generic.
- **Multi-select:** Selecting one or more providers shows only nodes from those providers. **Deselecting all** shows all nodes (equivalent to current "All"); "All" is not a separate option.
- Each toggle shows a **provider icon** (vendor logos for AWS/GCP/Azure, Lucide for Generic) with a **tooltip** for the label.
- URL and server preference store the **set** of selected providers; empty set = show all.

---

## 1. Filter behavior

- **Options:** Four toggles: AWS, GCP, Azure, Generic. Each can be on or off independently.
- **Meaning:** When at least one is selected, the list shows only nodes whose provider is in the selected set. When **none** are selected, the list shows all nodes ("All").
- **No "All" chip:** "All" is the state when no provider is selected, not a fifth option.

---

## 2. UI

- **Row:** Horizontal row of four icon-only buttons (no text labels). Same order: AWS, GCP, Azure, Generic.
- **Icons:** Vendor logos for AWS, GCP, Azure (hosted SVGs under `public/icons/providers/` or similar). Lucide `Box` (or `Package`) for Generic.
- **Tooltip:** Native `title` on each button: "AWS", "GCP", "Azure", "Generic". Add `aria-label` with the same text for screen readers.
- **Toggle state:** Selected = primary styling (e.g. `bg-primary text-primary-foreground`); unselected = muted. Click toggles that provider in/out of the set.
- **Layout:** Reuse current filter bar placement (above search); keep compact with icons only.

---

## 3. Data model

- **Provider set:** Type is a set (or sorted array) of provider codes: `"aws" | "gcp" | "azure" | "generic"`. No `"all"` value.
- **Schema:** Keep a single-provider schema for validation of one code; add (or use) an array schema for the filter state, e.g. `z.array(NodeLibraryProviderSchema).optional()` where `NodeLibraryProviderSchema` is `z.enum(["aws", "gcp", "azure", "generic"])` (remove `"all"`).
- **URL:** e.g. `?providers=aws,gcp`. Absent or empty = no filter (show all). Parse to set; serialize set to comma-separated for URL.
- **Preference:** Store selected set as comma-separated string in `user_preferences.value` (e.g. `"aws,gcp"`). Empty string = no preference / show all. Backward compatibility: if existing value is `"all"`, treat as empty set.

---

## 4. Catalog and API

- **getServicesByCategory(providers: readonly NodeLibraryProvider[]):** When `providers.length === 0`, return all services (current "all" behavior). Otherwise filter to entries where `getProviderFromType(entry.type)` is in `providers`. Keep category grouping and generic-first sort within category.
- **searchServices(query, providers?):** When filtering, restrict search to the same provider set (empty = all).
- **getProviderFromType:** Unchanged; return type becomes `"aws" | "gcp" | "azure" | "generic"` only (no `"all"`).

---

## 5. Preferences (server)

- **GET /api/preferences:** Return `{ providers: string[] }` (e.g. `["aws", "gcp"]`). Empty array when none selected or no stored preference. If stored value is `"all"`, return `[]`.
- **PATCH /api/preferences:** Accept `{ providers: string[] }`. Validate each element with provider enum (no `"all"`). Store as comma-separated string. Empty array → store `""` or omit.
- **user_preferences table:** No schema change; `value` remains a string (comma-separated list).

---

## 6. Out of scope

- Migrating existing canvas node types.
- Radix or custom tooltip component; use native `title` + `aria-label`.

---

## 7. Success criteria

- Users see four icon-only toggles (AWS, GCP, Azure, Generic) with tooltips.
- Selecting one or more providers filters the list to those providers; deselecting all shows all nodes.
- URL reflects selected set (`?providers=aws,gcp`); empty when none selected.
- Preference persists across sessions (signed-in users); anonymous can use URL/local state only if applicable.
