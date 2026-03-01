"use client";

import ReactMarkdown from "react-markdown";
import type { Options as MarkdownOptions } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
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
  const isAssistant = message.role === "assistant";

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
      <div
        className={cn(
          "mt-0.5 break-words",
          isAssistant ? "chat-markdown" : "whitespace-pre-wrap"
        )}
      >
        {isAssistant ? (
          <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks] as MarkdownOptions['remarkPlugins']}>
            {message.content}
          </ReactMarkdown>
        ) : (
          message.content
        )}
      </div>
    </div>
  );
}
