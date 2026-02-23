"use client";

import { useState, type DragEvent } from "react";
import Image from "next/image";
import { Search, ChevronRight, GripVertical, StickyNote } from "lucide-react";
import {
  CATEGORY_ORDER,
  CATEGORY_LABELS,
  getServicesByCategory,
  searchServices,
  type ServiceCategory,
  type ServiceEntry,
} from "@/lib/serviceCatalog";
import { getAwsIconUrl } from "@/lib/awsNodeIcons";
import { getGcpIconUrl } from "@/lib/gcpNodeIcons";
import { getGenericIcon } from "@/lib/genericNodeIcons";

function onDragStart(e: DragEvent, entry: ServiceEntry): void {
  e.dataTransfer.setData("application/reactflow-type", entry.type);
  e.dataTransfer.setData("application/reactflow-label", entry.label);
  e.dataTransfer.effectAllowed = "move";
}

function ServiceItem({ entry }: { entry: ServiceEntry }): React.ReactElement {
  const iconUrl =
    entry.type === "text"
      ? null
      : getAwsIconUrl(entry.type) ?? getGcpIconUrl(entry.type);
  const GenericIcon = entry.type === "text" ? null : getGenericIcon(entry.type);
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
      ) : iconUrl ? (
        <Image
          src={iconUrl}
          alt=""
          width={20}
          height={20}
          className="h-5 w-5 shrink-0 object-contain"
          unoptimized
        />
      ) : GenericIcon ? (
        <GenericIcon className="h-5 w-5 shrink-0 text-foreground/70" aria-hidden />
      ) : (
        <div className="h-5 w-5 shrink-0" />
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
  const [query, setQuery] = useState("");
  const isSearching = query.trim().length > 0;

  return (
    <div className={`flex h-full flex-col ${className}`}>
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
            {searchServices(query).map((s) => (
              <ServiceItem key={s.type} entry={s} />
            ))}
            {searchServices(query).length === 0 && (
              <p className="px-2 py-4 text-center text-xs text-foreground/40">
                No services found
              </p>
            )}
          </div>
        ) : (
          CATEGORY_ORDER.map((cat) => {
            const services = getServicesByCategory().get(cat);
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
