"use client";

import type { ReactNode } from "react";
import {
  AssistantRuntimeProvider,
  useLocalRuntime,
  type ChatModelAdapter,
  type ChatModelRunResult,
} from "@assistant-ui/react";

const PDEChatAdapter: ChatModelAdapter = {
  async *run({ messages, abortSignal }): AsyncGenerator<ChatModelRunResult, void> {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: messages.map((m) => ({
          role: m.role,
          content:
            m.role === "user"
              ? m.content
                  .filter((c) => c.type === "text")
                  .map((c) => c.text)
                  .join("\n")
              : m.content,
        })),
      }),
      signal: abortSignal,
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    if (!response.body) {
      const data = await response.json();
      yield {
        content: [{ type: "text" as const, text: data.text ?? JSON.stringify(data) }],
      };
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = "";
    const toolCalls = new Map<
      string,
      {
        toolCallId: string;
        toolName: string;
        args: Record<string, unknown>;
        argsText: string;
        result?: unknown;
      }
    >();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n").filter((l) => l.startsWith("data: "));

      for (const line of lines) {
        const data = line.slice(6);
        if (data === "[DONE]") continue;

        try {
          const event = JSON.parse(data);

          if (event.type === "text_delta") {
            fullText += event.text;
          } else if (event.type === "text") {
            fullText = event.text;
          } else if (event.type === "tool_call") {
            toolCalls.set(event.tool_call_id, {
              toolCallId: event.tool_call_id,
              toolName: event.tool_name,
              args: event.args,
              argsText: JSON.stringify(event.args),
            });
          } else if (event.type === "tool_result") {
            const tc = toolCalls.get(event.tool_call_id);
            if (tc) {
              tc.result = event.result;
            }
          }
        } catch {
          // skip malformed JSON
        }
      }

      const parts: Array<
        | { type: "text"; text: string }
        | {
            type: "tool-call";
            toolCallId: string;
            toolName: string;
            args: Record<string, unknown>;
            argsText: string;
            result?: unknown;
          }
      > = [];

      if (fullText) {
        parts.push({ type: "text", text: fullText });
      }
      for (const tc of toolCalls.values()) {
        parts.push({
          type: "tool-call",
          toolCallId: tc.toolCallId,
          toolName: tc.toolName,
          args: tc.args,
          argsText: tc.argsText,
          result: tc.result,
        });
      }

      if (parts.length > 0) {
        yield { content: parts } as ChatModelRunResult;
      }
    }
  },
};

export function MyRuntimeProvider({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const runtime = useLocalRuntime(PDEChatAdapter);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  );
}
