"use client";

import { SessionSelector } from "@/components/chat/SessionSelector";

export function InterviewLanding(): React.ReactElement {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground">
        Select a session or create a new one to open the canvas and chat.
      </p>
      <div className="max-w-sm">
        <SessionSelector />
      </div>
    </div>
  );
}
