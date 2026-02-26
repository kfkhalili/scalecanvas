"use client";

import { Option } from "effect";
import { useState, useCallback, useEffect, type DragEvent } from "react";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, ChevronRight, GripVertical, StickyNote } from "lucide-react";
import { whenSome } from "@/lib/optionHelpers";
import {
  CATEGORY_ORDER,
  CATEGORY_LABELS,
  getProviderFromType,
  getServicesByCategory,
  searchServices,
  type ServiceCategory,
  type ServiceEntry,
} from "@/lib/serviceCatalog";
import { getNodeIconUrl, getNodeIconComponent } from "@/lib/nodeIconResolver";
import type { NodeLibraryProvider } from "@/lib/types";

const PROVIDER_OPTIONS: { value: NodeLibraryProvider; label: string }[] = [
  { value: "all", label: "All" },
  { value: "aws", label: "AWS" },
  { value: "gcp", label: "GCP" },
  { value: "azure", label: "Azure" },
  { value: "generic", label: "Generic" },
];

function parseProviderFromUrl(param: Option.Option<string>): NodeLibraryProvider {
  return Option.match(param, {
    onNone: () => "all" as const,
    onSome: (p) =>
      p === "all" || p === "aws" || p === "gcp" || p === "azure" || p === "generic"
        ? p
        : ("all" as const),
  });
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

type NodeLibraryProps = {
  className?: string;
};

export function NodeLibrary({ className = "" }: NodeLibraryProps): React.ReactElement {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");

  const providerFromUrl = parseProviderFromUrl(
    Option.fromNullable(searchParams.get("provider"))
  );
  const [provider, setProviderState] = useState<NodeLibraryProvider>(providerFromUrl);

  useEffect(() => {
    setProviderState(providerFromUrl);
  }, [providerFromUrl]);

  useEffect(() => {
    if (Option.isSome(Option.fromNullable(searchParams.get("provider")))) return;
    fetch("/api/preferences")
      .then((r) =>
        r.ok
          ? (r.json() as Promise<{ provider?: string }>).then((d) => Option.some(d))
          : Promise.resolve(Option.none())
      )
      .then((dataOpt) => {
        const providerOpt = Option.flatMap(dataOpt, (d) =>
          Option.fromNullable(d.provider)
        );
        whenSome(providerOpt, (raw) => {
          if (parseProviderFromUrl(Option.some(raw)) === "all") return;
          setProviderState(parseProviderFromUrl(Option.some(raw)));
          const nextParams = new URLSearchParams(searchParams);
          nextParams.set("provider", raw);
          router.replace(`${pathname}?${nextParams.toString()}`);
        });
      })
      .catch(() => {});
  }, [pathname, router, searchParams]);

  const setProvider = useCallback(
    (next: NodeLibraryProvider) => {
      setProviderState(next);
      const nextParams = new URLSearchParams(searchParams);
      if (next === "all") nextParams.delete("provider");
      else nextParams.set("provider", next);
      const qs = nextParams.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
      fetch("/api/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: next }),
      }).catch(() => {});
    },
    [pathname, router, searchParams]
  );

  const isSearching = query.trim().length > 0;
  const catalogByCategory = getServicesByCategory(provider);
  const searchResults = isSearching
    ? (() => {
        const raw = searchServices(query);
        if (provider === "all") return raw;
        return raw.filter((s) => getProviderFromType(s.type) === provider);
      })()
    : [];

  return (
    <div className={`flex h-full flex-col ${className}`}>
      {/* Provider filter */}
      <div className="shrink-0 border-b border-foreground/5 px-2 py-1.5">
        <div className="flex flex-wrap gap-1">
          {PROVIDER_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setProvider(value)}
              className={`rounded px-2 py-1 text-xs font-medium transition-colors focus:outline-none ${
                provider === value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground/70 hover:bg-muted/80 hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
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
