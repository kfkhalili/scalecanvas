"use client";

import { Option } from "effect";
import { Effect, Either } from "effect";
import { useState, useCallback, useEffect, useMemo, useRef, type DragEvent } from "react";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, ChevronRight, GripVertical, StickyNote } from "lucide-react";
import { NodeLibraryProviderSchema } from "@/lib/api.schemas";
import {
  fetchNodeLibraryProviders,
  saveNodeLibraryProviders,
} from "@/services/preferencesClient";
import { parseProvidersValue, serializeProviders } from "@/lib/userPreferences";
import {
  CATEGORY_ORDER,
  CATEGORY_LABELS,
  getServicesByCategory,
  searchServices,
  type ServiceCategory,
  type ServiceEntry,
} from "@/lib/serviceCatalog";
import { getNodeIconUrl, getNodeIconComponent } from "@/lib/nodeIconResolver";
import { shouldFetchPreferencesWhenNoProviders } from "@/lib/nodeLibraryPreferencesLoad";
import { getProviderIcon } from "@/lib/providerIcons";
import type { NodeLibraryProvider } from "@/lib/types";

const PROVIDER_OPTIONS: { value: NodeLibraryProvider; label: string }[] = [
  { value: "aws", label: "AWS" },
  { value: "gcp", label: "GCP" },
  { value: "azure", label: "Azure" },
  { value: "generic", label: "Generic" },
];

function parseProvidersFromUrl(param: Option.Option<string>): NodeLibraryProvider[] {
  return Option.match(param, {
    onNone: () => [],
    onSome: (s) => {
      const trimmed = s.trim();
      if (trimmed === "") return [];
      const parts = trimmed.split(",").map((p) => p.trim()).filter(Boolean);
      const parsed: NodeLibraryProvider[] = [];
      const seen = new Set<NodeLibraryProvider>();
      for (const part of parts) {
        const result = NodeLibraryProviderSchema.safeParse(part);
        if (result.success && !seen.has(result.data)) {
          seen.add(result.data);
          parsed.push(result.data);
        }
      }
      return parsed;
    },
  });
}

function parseProviderSingularCompat(value: string | null): NodeLibraryProvider[] {
  if (value === null || value === undefined) return [];
  const trimmed = value.trim();
  if (trimmed === "" || trimmed === "all") return [];
  const result = NodeLibraryProviderSchema.safeParse(trimmed);
  return result.success ? [result.data] : [];
}

function deriveProvidersFromSearchParams(searchParams: URLSearchParams): NodeLibraryProvider[] {
  const providersParam = searchParams.get("providers");
  const providerParam = searchParams.get("provider");
  if (providersParam !== null && providersParam !== undefined) {
    return parseProvidersFromUrl(Option.some(providersParam));
  }
  if (providerParam !== null && providerParam !== undefined) {
    return parseProviderSingularCompat(providerParam);
  }
  return [];
}

function onDragStart(e: DragEvent, entry: ServiceEntry): void {
  e.dataTransfer.setData("application/reactflow-type", entry.type);
  e.dataTransfer.setData("application/reactflow-label", entry.label);
  e.dataTransfer.effectAllowed = "move";
}

function ServiceItem({ entry }: { entry: ServiceEntry }): React.ReactElement {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, entry)}
      className="group flex cursor-grab items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted active:cursor-grabbing"
      title={entry.description}
    >
      <GripVertical className="h-3.5 w-3.5 shrink-0 text-foreground/20 group-hover:text-foreground/40" />
      {entry.type === "text" ? (
        <StickyNote className="h-5 w-5 shrink-0 text-foreground/80" />
      ) : (
        Option.match(getNodeIconUrl(entry.type), {
          onNone: () =>
            Option.match(getNodeIconComponent(entry.type), {
              onNone: () => <div className="h-5 w-5 shrink-0" />,
              onSome: (GenericIcon) => (
                <GenericIcon className="h-5 w-5 shrink-0 text-foreground/70" aria-hidden />
              ),
            }),
          onSome: (iconUrl) => (
            <Image
              src={iconUrl}
              alt=""
              width={20}
              height={20}
              className="h-5 w-5 shrink-0 object-contain"
              unoptimized
            />
          ),
        })
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-foreground/80">{entry.label}</div>
      </div>
    </div>
  );
}

function CategoryGroup({
  category,
  services,
}: {
  category: ServiceCategory;
  services: ServiceEntry[];
}): React.ReactElement {
  const [expanded, setExpanded] = useState(true);

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-1.5 px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-foreground/50 transition-colors hover:text-foreground/70 focus:outline-none"
      >
        <ChevronRight
          className={`h-3 w-3 shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`}
        />
        {CATEGORY_LABELS[category]}
        <span className="ml-auto text-foreground/30">{services.length}</span>
      </button>
      {expanded && (
        <div className="ml-1">
          {services.map((s) => (
            <ServiceItem key={s.type} entry={s} />
          ))}
        </div>
      )}
    </div>
  );
}

const ANON_PROVIDER_KEY = "scalecanvas-provider";

type NodeLibraryProps = {
  className?: string;
  isAnonymous?: boolean;
};

export function NodeLibrary({ className = "", isAnonymous = false }: NodeLibraryProps): React.ReactElement {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const providerSetFromUrl = useMemo(
    () => deriveProvidersFromSearchParams(searchParams),
    [searchParams]
  );
  const [providers, setProviders] = useState<NodeLibraryProvider[]>(providerSetFromUrl);

  useEffect(() => {
    setProviders(providerSetFromUrl);
  }, [providerSetFromUrl]);

  // Backward compatibility: URL has "provider" (singular) but no "providers" → replace with "providers"
  useEffect(() => {
    const providersParam = searchParams.get("providers");
    const providerParam = searchParams.get("provider");
    if (providerParam !== null && providerParam !== undefined && providersParam === null) {
      const arr = parseProviderSingularCompat(providerParam);
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("provider");
      if (arr.length > 0) nextParams.set("providers", arr.join(","));
      const qs = nextParams.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    }
  }, [pathname, router, searchParams]);

  // Only fetch preferences once when URL has no providers (avoids loop when auth/session re-renders)
  const hasFetchedWhenNoProviders = useRef(false);

  // Load preference when URL has no providers
  useEffect(() => {
    const providersParam = searchParams.get("providers");
    if (providersParam !== null && providersParam !== "") {
      hasFetchedWhenNoProviders.current = false;
      return;
    }

    if (isAnonymous) {
      try {
        const stored = localStorage.getItem(ANON_PROVIDER_KEY);
        if (stored) {
          const parsed = parseProvidersValue(stored);
          setProviders(parsed);
          const nextParams = new URLSearchParams(searchParams);
          if (parsed.length > 0) nextParams.set("providers", serializeProviders(parsed));
          const qs = nextParams.toString();
          router.replace(qs ? `${pathname}?${qs}` : pathname);
        }
      } catch {
        // private browsing / quota
      }
      return;
    }

    if (!shouldFetchPreferencesWhenNoProviders(false, isAnonymous, hasFetchedWhenNoProviders.current))
      return;
    hasFetchedWhenNoProviders.current = true;

    void Effect.runPromise(Effect.either(fetchNodeLibraryProviders())).then((either) => {
      Either.match(either, {
        onLeft: () => {
          hasFetchedWhenNoProviders.current = false;
        },
        onRight: (providerOpt) => {
          const arr = Option.getOrElse(providerOpt, () => []);
          setProviders(arr);
          const nextParams = new URLSearchParams(searchParams);
          if (arr.length > 0) nextParams.set("providers", serializeProviders(arr));
          const qs = nextParams.toString();
          router.replace(qs ? `${pathname}?${qs}` : pathname);
        },
      });
    });
  }, [pathname, router, searchParams, isAnonymous]);

  const toggleProvider = useCallback(
    (p: NodeLibraryProvider) => {
      const next = providers.includes(p)
        ? providers.filter((x) => x !== p)
        : [...providers, p];
      setProviders(next);
      const nextParams = new URLSearchParams(searchParams);
      if (next.length === 0) nextParams.delete("providers");
      else nextParams.set("providers", next.join(","));
      const qs = nextParams.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);

      if (isAnonymous) {
        try {
          localStorage.setItem(ANON_PROVIDER_KEY, serializeProviders(next));
        } catch {
          // ignore
        }
      } else {
        void Effect.runPromise(Effect.either(saveNodeLibraryProviders(next)));
      }
    },
    [pathname, router, searchParams, isAnonymous, providers]
  );

  const [query, setQuery] = useState("");
  const isSearching = query.trim().length > 0;
  const catalogByCategory = getServicesByCategory(providers);
  const searchResults = isSearching ? searchServices(query, providers) : [];

  return (
    <div className={`flex h-full flex-col ${className}`}>
      {/* Provider filter: icon-only toggles */}
      <div className="shrink-0 border-b border-foreground/5 px-2 py-1.5">
        <div className="flex flex-wrap gap-1">
          {PROVIDER_OPTIONS.map(({ value, label }) => {
            const icon = getProviderIcon(value);
            const selected = providers.includes(value);
            return (
              <button
                key={value}
                type="button"
                onClick={() => toggleProvider(value)}
                title={label}
                aria-label={label}
                className={`rounded p-2 transition-colors focus:outline-none ${
                  selected
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground/70 hover:bg-muted/80 hover:text-foreground"
                }`}
              >
                {icon.type === "image" ? (
                  <Image
                    src={icon.src}
                    alt=""
                    width={28}
                    height={28}
                    className="h-7 w-7 object-contain"
                    unoptimized
                  />
                ) : (
                  <icon.Icon className="h-7 w-7" aria-hidden />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Search bar */}
      <div className="shrink-0 border-b border-foreground/5 px-3 py-2">
        <div className="flex items-center gap-2 rounded-lg bg-muted px-2.5 py-1.5">
          <Search className="h-3.5 w-3.5 shrink-0 text-foreground/40" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search services…"
            className="w-full bg-transparent text-sm text-foreground placeholder:text-foreground/30 focus:outline-none"
          />
        </div>
      </div>

      {/* Service list */}
      <div className="min-h-0 flex-1 overflow-y-auto px-1 py-1">
        {isSearching ? (
          <div className="px-1">
            {searchResults.map((s) => (
              <ServiceItem key={s.type} entry={s} />
            ))}
            {searchResults.length === 0 && (
              <p className="px-2 py-4 text-center text-xs text-foreground/40">
                No services found
              </p>
            )}
          </div>
        ) : (
          CATEGORY_ORDER.map((cat) => {
            const services = catalogByCategory.get(cat);
            if (!services || services.length === 0) return null;
            return (
              <CategoryGroup key={cat} category={cat} services={services} />
            );
          })
        )}
      </div>
    </div>
  );
}
