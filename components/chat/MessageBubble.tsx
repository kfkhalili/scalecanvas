"use client";

import { cn } from "@/lib/utils";

export type DisplayMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
};

type MessageBubbleProps = {
  message: DisplayMessage;
};

export function MessageBubble({ message }: MessageBubbleProps): React.ReactElement {
  const isUser = message.role === "user";
  return (
    <div
      className={cn(
        "mb-2 max-w-[85%] rounded-lg px-3 py-2 text-sm",
        isUser
          ? "ml-auto bg-primary text-primary-foreground"
          : "mr-auto bg-muted text-muted-foreground"
      )}
    >
      <div className="font-medium opacity-80">
        {isUser ? "You" : "Trainer"}
      </div>
      <div className="mt-0.5 whitespace-pre-wrap break-words">
        {message.content}
      </div>
    </div>
  );
}
