"use client";

import { useRef, useEffect } from "react";
import { MessageBubble, type DisplayMessage } from "./MessageBubble";

type TranscriptViewProps = {
  messages: ReadonlyArray<DisplayMessage>;
  /** When set, shown when there are no messages (e.g. anonymous placeholder). */
  emptyPlaceholder?: string;
};

export function TranscriptView({ messages, emptyPlaceholder }: TranscriptViewProps): React.ReactElement {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const emptyText = emptyPlaceholder ?? "No messages yet. Send a message to start.";

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex-1 space-y-1 p-2">
        {messages.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {emptyText}
          </p>
        ) : (
          messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))
        )}
      </div>
      <div ref={bottomRef} />
    </div>
  );
}
