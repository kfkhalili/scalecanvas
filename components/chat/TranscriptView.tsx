"use client";

import { useRef, useEffect } from "react";
import { MessageBubble, type DisplayMessage } from "./MessageBubble";

type TranscriptViewProps = {
  messages: ReadonlyArray<DisplayMessage>;
};

export function TranscriptView({ messages }: TranscriptViewProps): React.ReactElement {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex-1 space-y-1 p-2">
        {messages.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No messages yet. Send a message to start.
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
