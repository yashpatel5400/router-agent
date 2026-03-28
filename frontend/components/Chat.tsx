"use client";

import { useChat, type UIMessage } from "@ai-sdk/react";
import Markdown from "react-markdown";
import { SendHorizontalIcon, Loader2Icon } from "lucide-react";
import { FC, useRef, useEffect, FormEvent, useState } from "react";

export const Chat: FC = () => {
  const { messages, sendMessage, status, error } = useChat();
  const viewportRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");

  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage({ text: input.trim() });
    setInput("");
  };

  const setInputAndSubmit = (text: string) => {
    if (isLoading) return;
    sendMessage({ text });
  };

  return (
    <div className="flex h-full flex-col">
      <div
        ref={viewportRef}
        className="flex flex-1 flex-col items-center overflow-y-auto scroll-smooth px-4 pt-8"
      >
        {messages.length === 0 && <EmptyState onPrompt={setInputAndSubmit} />}

        <div className="flex w-full max-w-2xl flex-col gap-4 pb-4">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          {isLoading && messages.length > 0 && !hasAssistantContent(messages) && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground px-1">
              <Loader2Icon className="h-4 w-4 animate-spin" />
              <span>Thinking...</span>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="mx-auto w-full max-w-2xl px-4 pb-2">
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-600 dark:text-red-400">
            {error.message}
          </div>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="mx-auto flex w-full max-w-2xl items-end gap-2 rounded-t-xl border border-border bg-card p-3 shadow-sm"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
          autoFocus
          placeholder="Describe your thermal design problem..."
          rows={1}
          className="flex-1 resize-none border-none bg-transparent p-2 text-sm outline-none placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-foreground text-background transition-opacity hover:opacity-80 disabled:opacity-30"
        >
          {isLoading ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <SendHorizontalIcon className="size-4" />
          )}
        </button>
      </form>
    </div>
  );
};

function hasAssistantContent(messages: UIMessage[]): boolean {
  const last = messages[messages.length - 1];
  return last?.role === "assistant" && last.parts.length > 0;
}

const EmptyState: FC<{ onPrompt: (text: string) => void }> = ({
  onPrompt,
}) => (
  <div className="flex flex-col items-center gap-4 text-center max-w-md mx-auto py-16">
    <div className="rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 p-4 shadow-lg">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2v10" />
        <path d="M18.4 6.6a9 9 0 1 1-12.77.04" />
      </svg>
    </div>
    <h2 className="text-2xl font-bold text-foreground">
      PDE Thermal Design Optimizer
    </h2>
    <p className="text-muted-foreground text-sm leading-relaxed">
      Describe a thermal design problem and I&apos;ll iteratively optimize it
      using physics simulation. I can place heat sources, tune conductivity,
      simulate temperature fields, and find designs that meet your constraints.
    </p>
    <div className="grid gap-2 text-xs text-muted-foreground w-full">
      <button
        className="rounded-lg border border-border bg-card p-3 text-left hover:bg-accent transition-colors cursor-pointer"
        onClick={() =>
          onPrompt(
            "I have two chips at (0.3, 0.3) and (0.7, 0.7) each generating heat with intensity 500. Keep peak temperature below 1.0."
          )
        }
      >
        &quot;Two chips at (0.3, 0.3) and (0.7, 0.7) with intensity 500. Keep
        peak temp below 1.0&quot;
      </button>
      <button
        className="rounded-lg border border-border bg-card p-3 text-left hover:bg-accent transition-colors cursor-pointer"
        onClick={() =>
          onPrompt(
            "Design a heat sink layout with 3 sources along the center line. Minimize the maximum temperature."
          )
        }
      >
        &quot;3 sources along center line — minimize peak temperature&quot;
      </button>
    </div>
  </div>
);

const MessageBubble: FC<{ message: UIMessage }> = ({ message }) => {
  if (message.role === "user") {
    const text = message.parts
      .filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("");
    return (
      <div className="flex w-full flex-col items-end gap-1">
        <div className="rounded-2xl rounded-br-md bg-foreground px-4 py-2.5 text-sm text-background max-w-[80%]">
          {text}
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col items-start gap-1">
      <div className="rounded-2xl rounded-bl-md bg-card border border-border px-4 py-2.5 text-sm max-w-full overflow-x-auto">
        {message.parts.map((part, i) => {
          if (part.type === "text") {
            return <TextPart key={i} text={part.text} />;
          }
          if (part.type === "dynamic-tool") {
            return (
              <ToolCallDisplay
                key={i}
                toolName={part.toolName}
                state={part.state}
                input={part.input}
                output={"output" in part ? part.output : undefined}
                errorText={"errorText" in part ? part.errorText : undefined}
              />
            );
          }
          return null;
        })}
      </div>
    </div>
  );
};

const TextPart: FC<{ text: string }> = ({ text }) => {
  if (!text.trim()) return null;
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <Markdown>{text}</Markdown>
    </div>
  );
};

const ToolCallDisplay: FC<{
  toolName: string;
  state: string;
  input: unknown;
  output?: unknown;
  errorText?: string;
}> = ({ toolName, state, output, errorText }) => {
  const toolLabels: Record<string, [string, string]> = {
    solve_thermal: ["Solving thermal problem...", "Solve complete"],
    evaluate_design: ["Evaluating design...", "Evaluation complete"],
    visualize: ["Generating heatmap...", "Visualization ready"],
  };

  const [runningLabel, doneLabel] = toolLabels[toolName] || [
    `Running ${toolName}...`,
    toolName,
  ];

  const isDone = state === "result";
  const isError = state === "error";
  const isRunning = !isDone && !isError;
  const label = isDone ? doneLabel : isError ? `${toolName} failed` : runningLabel;

  let resultObj: Record<string, unknown> | undefined;
  if (isDone && output) {
    try {
      resultObj =
        typeof output === "string" ? JSON.parse(output) : (output as Record<string, unknown>);
    } catch {
      resultObj = undefined;
    }
  }

  return (
    <div className="my-2 rounded-lg border border-border bg-muted/30 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/50">
        <div
          className={`h-2 w-2 rounded-full ${
            isDone
              ? resultObj?.error
                ? "bg-red-500"
                : "bg-green-500"
              : isError
                ? "bg-red-500"
                : "bg-yellow-500 animate-pulse"
          }`}
        />
        <span className="text-xs font-medium">{label}</span>
        {isRunning && (
          <Loader2Icon className="ml-auto h-3 w-3 animate-spin text-muted-foreground" />
        )}
      </div>

      {isRunning && (
        <div className="px-3 py-2 text-xs text-muted-foreground">
          {toolName === "solve_thermal" && "Running SOR solver on the PDE grid..."}
          {toolName === "evaluate_design" && "Computing temperature metrics and checking constraints..."}
          {toolName === "visualize" && "Rendering heatmap from temperature field..."}
        </div>
      )}

      {isError && errorText && (
        <div className="p-3 text-xs text-red-600 dark:text-red-400 bg-red-500/10">
          {errorText}
        </div>
      )}

      {isDone && resultObj && (
        <div className="p-3 space-y-2">
          {resultObj.error ? (
            <div className="text-xs text-red-600 dark:text-red-400 bg-red-500/10 px-2 py-1.5 rounded">
              Error: {String(resultObj.error)}
            </div>
          ) : (
            <>
              {toolName === "solve_thermal" && <SolveResult result={resultObj} />}
              {toolName === "evaluate_design" && <EvaluateResult result={resultObj} />}
              {toolName === "visualize" && <VisualizeResult result={resultObj} />}
              {!["solve_thermal", "evaluate_design", "visualize"].includes(toolName) && (
                <pre className="text-xs overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(resultObj, null, 2)}
                </pre>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

const SolveResult: FC<{ result: Record<string, unknown> }> = ({ result }) => (
  <div className="space-y-3">
    <div className="grid grid-cols-3 gap-2 text-xs">
      <Stat label="Iterations" value={String(result.iterations ?? "—")} />
      <Stat label="Time" value={`${result.elapsed_seconds ?? "—"}s`} />
      <Stat
        label="Grid"
        value={`${result.grid_size ?? "—"}×${result.grid_size ?? "—"}`}
      />
    </div>
    {typeof result.heatmap_url === "string" && (
      <div className="rounded-md overflow-hidden border border-border">
        <img src={result.heatmap_url} alt="Temperature heatmap" className="w-full" />
      </div>
    )}
  </div>
);

const EvaluateResult: FC<{ result: Record<string, unknown> }> = ({ result }) => {
  const meets = result.meets_target;
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2 text-xs">
        <Stat
          label="Max Temp"
          value={String(result.max_temperature ?? "—")}
          highlight={meets === false}
        />
        <Stat label="Mean Temp" value={String(result.mean_temperature ?? "—")} />
        <Stat label="Compliance" value={String(result.thermal_compliance ?? "—")} />
      </div>
      {meets !== undefined && (
        <div
          className={`text-xs font-medium px-2 py-1 rounded ${
            meets
              ? "bg-green-500/10 text-green-700 dark:text-green-400"
              : "bg-red-500/10 text-red-700 dark:text-red-400"
          }`}
        >
          {meets
            ? `Target met (margin: ${result.margin})`
            : `Target NOT met (over by ${Math.abs(Number(result.margin ?? 0)).toFixed(4)})`}
        </div>
      )}
    </div>
  );
};

const VisualizeResult: FC<{ result: Record<string, unknown> }> = ({ result }) => {
  const url = result.heatmap_url as string | undefined;
  if (url) {
    return (
      <div className="rounded-md overflow-hidden border border-border">
        <img src={url} alt="Temperature heatmap" className="w-full" />
      </div>
    );
  }
  return <div className="text-xs text-muted-foreground">Visualization generated</div>;
};

const Stat: FC<{ label: string; value: string; highlight?: boolean }> = ({
  label,
  value,
  highlight,
}) => (
  <div className={`rounded-md px-2 py-1.5 ${highlight ? "bg-red-500/10" : "bg-muted/50"}`}>
    <div className="text-muted-foreground text-[10px] uppercase tracking-wider">
      {label}
    </div>
    <div className={`font-mono font-semibold ${highlight ? "text-red-600 dark:text-red-400" : ""}`}>
      {value}
    </div>
  </div>
);
