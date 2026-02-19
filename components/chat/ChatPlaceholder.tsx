"use client";

export function ChatPlaceholder(): React.ReactElement {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 rounded border border-dashed border-muted-foreground/30 bg-muted/20 p-4 text-muted-foreground">
      <p className="text-sm">Chat will appear here (Phase 5).</p>
      <p className="text-xs">Send messages to the AI interviewer.</p>
    </div>
  );
}
