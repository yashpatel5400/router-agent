"use client";

import {
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
} from "@assistant-ui/react";
import { MarkdownTextPrimitive } from "@assistant-ui/react-markdown";
import { SendHorizontalIcon } from "lucide-react";
import { FC } from "react";

export const Thread: FC = () => {
  return (
    <ThreadPrimitive.Root className="flex h-full flex-col">
      <ThreadPrimitive.Viewport className="flex flex-1 flex-col items-center overflow-y-auto scroll-smooth px-4 pt-8">
        <ThreadPrimitive.Empty>
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
              Describe a thermal design problem and I&apos;ll iteratively
              optimize it using physics simulation. I can place heat sources,
              tune conductivity, simulate temperature fields, and find designs
              that meet your constraints.
            </p>
            <div className="grid gap-2 text-xs text-muted-foreground w-full">
              <button
                className="rounded-lg border border-border bg-card p-3 text-left hover:bg-accent transition-colors cursor-pointer"
                onClick={() => {
                  const composer = document.querySelector("textarea");
                  if (composer) {
                    composer.value =
                      "I have two chips at (0.3, 0.3) and (0.7, 0.7) each generating heat with intensity 500. Keep peak temperature below 1.0.";
                    composer.dispatchEvent(
                      new Event("input", { bubbles: true })
                    );
                    composer.focus();
                  }
                }}
              >
                &quot;Two chips at (0.3, 0.3) and (0.7, 0.7) with intensity 500.
                Keep peak temp below 1.0&quot;
              </button>
              <button
                className="rounded-lg border border-border bg-card p-3 text-left hover:bg-accent transition-colors cursor-pointer"
                onClick={() => {
                  const composer = document.querySelector("textarea");
                  if (composer) {
                    composer.value =
                      "Design a heat sink layout with 3 sources along the center line. Minimize the maximum temperature.";
                    composer.dispatchEvent(
                      new Event("input", { bubbles: true })
                    );
                    composer.focus();
                  }
                }}
              >
                &quot;3 sources along center line — minimize peak
                temperature&quot;
              </button>
            </div>
          </div>
        </ThreadPrimitive.Empty>

        <ThreadPrimitive.Messages
          components={{
            UserMessage,
            AssistantMessage,
          }}
        />
      </ThreadPrimitive.Viewport>

      <Composer />
    </ThreadPrimitive.Root>
  );
};

const Composer: FC = () => {
  return (
    <ComposerPrimitive.Root className="mx-auto flex w-full max-w-2xl items-end gap-2 rounded-t-xl border border-border bg-card p-3 shadow-sm">
      <ComposerPrimitive.Input
        autoFocus
        placeholder="Describe your thermal design problem..."
        rows={1}
        className="flex-1 resize-none border-none bg-transparent p-2 text-sm outline-none placeholder:text-muted-foreground"
      />
      <ComposerPrimitive.Send className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-foreground text-background transition-opacity hover:opacity-80 disabled:opacity-30">
        <SendHorizontalIcon className="size-4" />
      </ComposerPrimitive.Send>
    </ComposerPrimitive.Root>
  );
};

const UserMessage: FC = () => {
  return (
    <MessagePrimitive.Root className="mb-4 flex w-full max-w-2xl flex-col items-end gap-1">
      <div className="rounded-2xl rounded-br-md bg-foreground px-4 py-2.5 text-sm text-background">
        <MessagePrimitive.Content />
      </div>
    </MessagePrimitive.Root>
  );
};

const AssistantMessage: FC = () => {
  return (
    <MessagePrimitive.Root className="mb-4 flex w-full max-w-2xl flex-col items-start gap-1">
      <div className="rounded-2xl rounded-bl-md bg-card border border-border px-4 py-2.5 text-sm max-w-full overflow-x-auto">
        <MessagePrimitive.Content
          components={{
            Text: MarkdownTextComponent,
            tools: {
              Fallback: ToolFallbackComponent,
            },
          }}
        />
      </div>
    </MessagePrimitive.Root>
  );
};

const MarkdownTextComponent: FC<{ text: string }> = () => {
  return (
    <MarkdownTextPrimitive className="prose prose-sm dark:prose-invert max-w-none" />
  );
};

const ToolFallbackComponent: FC<{
  toolName: string;
  toolCallId: string;
  argsText: string;
  args: Record<string, unknown>;
  result?: unknown;
  addResult: (result: unknown) => void;
  resume: (payload: unknown) => void;
  status: { type: string };
}> = ({ toolName, args, result }) => {
  return <ToolCallDisplay toolName={toolName} args={args} result={result} />;
};

const ToolCallDisplay: FC<{
  toolName: string;
  args: Record<string, unknown>;
  result?: unknown;
}> = ({ toolName, args, result }) => {
  const toolLabels: Record<string, string> = {
    solve_thermal: "Solving thermal problem",
    evaluate_design: "Evaluating design",
    visualize: "Generating visualization",
  };

  const label = toolLabels[toolName] || toolName;
  const hasResult = result !== undefined && result !== null;
  const resultObj =
    typeof result === "string" ? JSON.parse(result) : (result as Record<string, unknown> | undefined);

  return (
    <div className="my-2 rounded-lg border border-border bg-muted/30 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/50">
        <div
          className={`h-2 w-2 rounded-full ${hasResult ? "bg-green-500" : "bg-yellow-500 animate-pulse"}`}
        />
        <span className="text-xs font-medium">{label}</span>
      </div>

      {hasResult && resultObj && (
        <div className="p-3 space-y-2">
          {toolName === "solve_thermal" && (
            <SolveResult result={resultObj} />
          )}
          {toolName === "evaluate_design" && (
            <EvaluateResult result={resultObj} />
          )}
          {toolName === "visualize" && (
            <VisualizeResult result={resultObj} />
          )}
          {!["solve_thermal", "evaluate_design", "visualize"].includes(
            toolName
          ) && (
            <pre className="text-xs overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(resultObj, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
};

const SolveResult: FC<{ result: Record<string, unknown> }> = ({ result }) => (
  <div className="grid grid-cols-3 gap-2 text-xs">
    <Stat label="Iterations" value={String(result.iterations ?? "—")} />
    <Stat label="Time" value={`${result.elapsed_seconds ?? "—"}s`} />
    <Stat label="Grid" value={`${result.grid_size ?? "—"}×${result.grid_size ?? "—"}`} />
  </div>
);

const EvaluateResult: FC<{ result: Record<string, unknown> }> = ({
  result,
}) => {
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

const VisualizeResult: FC<{ result: Record<string, unknown> }> = ({
  result,
}) => {
  const path = result.heatmap_path as string | undefined;
  if (path) {
    return (
      <div className="text-xs text-muted-foreground">
        Heatmap saved to <code className="bg-muted px-1 rounded">{path}</code>
      </div>
    );
  }
  return (
    <div className="text-xs text-muted-foreground">Visualization generated</div>
  );
};

const Stat: FC<{ label: string; value: string; highlight?: boolean }> = ({
  label,
  value,
  highlight,
}) => (
  <div
    className={`rounded-md px-2 py-1.5 ${highlight ? "bg-red-500/10" : "bg-muted/50"}`}
  >
    <div className="text-muted-foreground text-[10px] uppercase tracking-wider">
      {label}
    </div>
    <div className={`font-mono font-semibold ${highlight ? "text-red-600 dark:text-red-400" : ""}`}>
      {value}
    </div>
  </div>
);
