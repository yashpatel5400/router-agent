"use client";

import { useChat, type UIMessage } from "@ai-sdk/react";
import Markdown from "react-markdown";
import {
  SendHorizontalIcon,
  Loader2Icon,
  ThermometerIcon,
  CpuIcon,
  ZapIcon,
  LayersIcon,
  ShieldIcon,
  FlameIcon,
} from "lucide-react";
import { type FC, useRef, useEffect, FormEvent, useState, forwardRef, useImperativeHandle } from "react";

export type ChatHandle = {
  reset: () => void;
};

export type SolverSnapshot = {
  iteration: number;
  timestamp: number;
  params: {
    grid_size: number;
    omega: number;
    tol: number;
    max_iters: number;
  };
  result?: {
    iterations: number;
    elapsed_seconds: number;
    final_residual: number;
  };
  evaluation?: {
    meets_target: boolean;
    peak_temp: number;
    target?: number;
  };
  isRunning: boolean;
};

const EXAMPLES = [
  {
    icon: CpuIcon,
    label: "Chip cooling challenge",
    prompt:
      "Two high-power chips at (0.4, 0.4) and (0.6, 0.6) each with intensity 2000 and radius 0.05. Target: peak temperature below 0.5. Start with uniform conductivity to see the baseline, then iterate with heat spreaders.",
  },
  {
    icon: LayersIcon,
    label: "Central hotspot",
    prompt:
      "A single extremely hot source at the center (0.5, 0.5) with intensity 5000 and radius 0.06. The center is the hardest location to cool since it's farthest from the boundaries. Get peak temp under 1.0 using high-conductivity pathways.",
  },
  {
    icon: ZapIcon,
    label: "Dense power grid",
    prompt:
      "6 power devices in a 2x3 grid: (0.35,0.3), (0.35,0.5), (0.35,0.7), (0.65,0.3), (0.65,0.5), (0.65,0.7), each intensity 1000, radius 0.04. They're tightly packed and interact thermally. Target: peak temp below 0.6.",
  },
  {
    icon: ShieldIcon,
    label: "Thermal protection",
    prompt:
      "Hot source at (0.5, 0.7) with intensity 3000, radius 0.06. A sensitive component sits at (0.5, 0.3) and must stay below 0.15 temperature. Design conductivity regions to shield the sensitive area while dissipating the heat.",
  },
  {
    icon: FlameIcon,
    label: "Asymmetric L-layout",
    prompt:
      "5 sources in an L-shape: (0.3,0.3) intensity 1500, (0.3,0.5) intensity 2000, (0.3,0.7) intensity 1500, (0.5,0.7) intensity 1000, (0.7,0.7) intensity 800. All radius 0.05. Get peak temp under 0.7. The asymmetric powers make this tricky.",
  },
  {
    icon: ThermometerIcon,
    label: "Uniform temperature",
    prompt:
      "3 sources at (0.25,0.5) intensity 1500, (0.5,0.5) intensity 2500, (0.75,0.5) intensity 1500, all radius 0.05. The center source is hotter. Goal: get peak temp under 0.6 AND minimize the gap between max and mean temperature.",
  },
];

type ChatProps = {
  onSolverUpdate?: (snapshots: SolverSnapshot[]) => void;
};

export const Chat = forwardRef<ChatHandle, ChatProps>(function Chat(
  { onSolverUpdate },
  ref,
) {
  const { messages, sendMessage, status, error, setMessages } = useChat();
  const viewportRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");

  useImperativeHandle(ref, () => ({
    reset() {
      setMessages([]);
      setInput("");
      onSolverUpdate?.([]);
    },
  }));

  const prevSnapshotKeyRef = useRef("");
  useEffect(() => {
    if (!onSolverUpdate) return;
    const snapshots = extractSolverSnapshots(messages);
    const key = snapshots
      .map((s) => `${s.iteration}:${s.isRunning}:${s.result?.iterations ?? ""}:${s.evaluation?.meets_target ?? ""}`)
      .join("|");
    if (key !== prevSnapshotKeyRef.current) {
      prevSnapshotKeyRef.current = key;
      onSolverUpdate(snapshots);
    }
  });

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

  const submit = (text: string) => {
    if (isLoading) return;
    sendMessage({ text });
  };

  return (
    <div className="flex flex-1 min-w-0 flex-col">
      <div
        ref={viewportRef}
        className="flex flex-1 flex-col overflow-y-auto scroll-smooth px-6 pt-8"
      >
        <div className="mx-auto w-full max-w-2xl">
          {messages.length === 0 && <EmptyState onPrompt={submit} />}

          <div className="flex w-full flex-col gap-4 pb-4">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {isLoading &&
              messages.length > 0 &&
              !hasAssistantContent(messages) && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground px-1">
                  <Loader2Icon className="h-4 w-4 animate-spin" />
                  <span>Thinking...</span>
                </div>
              )}
          </div>
        </div>
      </div>

      {error && (
        <div className="mx-auto w-full max-w-2xl px-6 pb-2">
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
          placeholder="Describe a thermal design problem..."
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
});

function hasAssistantContent(messages: UIMessage[]): boolean {
  const last = messages[messages.length - 1];
  return last?.role === "assistant" && last.parts.length > 0;
}

/* ---------- Empty state ---------- */

const EmptyState: FC<{ onPrompt: (text: string) => void }> = ({
  onPrompt,
}) => (
  <div className="flex flex-col items-center gap-6 text-center max-w-xl mx-auto py-12">
    <div className="rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 p-5 shadow-xl shadow-orange-500/20">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="40"
        height="40"
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
    <div className="space-y-2">
      <h2 className="text-2xl font-bold text-foreground">
        Thermal Design Agent
      </h2>
      <p className="text-muted-foreground text-sm leading-relaxed max-w-md mx-auto">
        Describe a thermal problem and the agent will autonomously iterate
        on the design — solving PDEs, evaluating constraints, and optimizing
        layouts until your targets are met.
      </p>
    </div>

    <div className="grid grid-cols-2 gap-2 w-full text-left">
      {EXAMPLES.map((ex) => (
        <button
          key={ex.label}
          className="group rounded-lg border border-border bg-card/50 p-3 hover:bg-accent hover:border-accent-foreground/20 transition-all cursor-pointer text-left"
          onClick={() => onPrompt(ex.prompt)}
        >
          <div className="flex items-center gap-2 mb-1">
            <ex.icon className="h-3.5 w-3.5 text-orange-500" />
            <span className="text-xs font-semibold text-foreground">
              {ex.label}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
            {ex.prompt}
          </p>
        </button>
      ))}
    </div>

    <div className="flex items-center gap-4 text-[10px] text-muted-foreground/60 uppercase tracking-widest">
      <span>2D Poisson PDE</span>
      <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
      <span>SOR Solver</span>
      <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
      <span>Autonomous Iteration</span>
    </div>
  </div>
);

/* ---------- Solver snapshot extraction ---------- */

function extractSolverSnapshots(messages: UIMessage[]): SolverSnapshot[] {
  const snapshots: SolverSnapshot[] = [];
  let iteration = 0;

  const allParts: { toolName: string; info: ToolPartInfo }[] = [];
  for (const msg of messages) {
    if (msg.role !== "assistant") continue;
    for (const part of msg.parts) {
      const info = extractToolInfo(part as { type: string; [key: string]: unknown });
      if (!info) continue;
      if (info.toolName === "solve_thermal" || info.toolName === "evaluate_design") {
        allParts.push({ toolName: info.toolName, info });
      }
    }
  }

  for (let i = 0; i < allParts.length; i++) {
    const { toolName, info } = allParts[i];
    if (toolName !== "solve_thermal") continue;

    iteration++;
    const inputObj = info.input as Record<string, unknown> | undefined;
    const outputObj =
      info.state === "output-available" && info.output
        ? typeof info.output === "string"
          ? JSON.parse(info.output)
          : info.output
        : undefined;

    const solverParams = (outputObj?.solver_params ?? {}) as Record<string, unknown>;

    let evaluation: SolverSnapshot["evaluation"];
    const next = allParts[i + 1];
    if (next?.toolName === "evaluate_design") {
      const evalOutput =
        next.info.state === "output-available" && next.info.output
          ? typeof next.info.output === "string"
            ? JSON.parse(next.info.output)
            : next.info.output
          : undefined;
      if (evalOutput && evalOutput.max_temperature !== undefined) {
        evaluation = {
          meets_target: !!evalOutput.meets_target,
          peak_temp: evalOutput.max_temperature as number,
          target: evalOutput.target_max_temp as number | undefined,
        };
      }
    }

    snapshots.push({
      iteration,
      timestamp: Date.now(),
      params: {
        grid_size: (solverParams.grid_size as number) ?? (inputObj?.grid_size as number) ?? 64,
        omega: (solverParams.omega as number) ?? (inputObj?.omega as number) ?? 1.5,
        tol: (solverParams.tol as number) ?? (inputObj?.tol as number) ?? 1e-6,
        max_iters: (solverParams.max_iters as number) ?? (inputObj?.max_iters as number) ?? 10000,
      },
      result: outputObj
        ? {
            iterations: outputObj.iterations as number,
            elapsed_seconds: outputObj.elapsed_seconds as number,
            final_residual: outputObj.final_residual as number,
          }
        : undefined,
      evaluation,
      isRunning: info.state !== "output-available" && info.state !== "output-error",
    });
  }

  return snapshots;
}

/* ---------- Tool info extraction ---------- */

type ToolPartInfo = {
  toolName: string;
  toolCallId: string;
  state: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
};

function extractToolInfo(
  part: { type: string; [key: string]: unknown },
): ToolPartInfo | null {
  if (part.type === "dynamic-tool") {
    return {
      toolName: part.toolName as string,
      toolCallId: part.toolCallId as string,
      state: part.state as string,
      input: part.input,
      output: part.output,
      errorText: part.errorText as string | undefined,
    };
  }
  if (part.type.startsWith("tool-")) {
    return {
      toolName: part.type.slice(5),
      toolCallId: part.toolCallId as string,
      state: part.state as string,
      input: part.input,
      output: part.output,
      errorText: part.errorText as string | undefined,
    };
  }
  return null;
}

/* ---------- Message rendering ---------- */

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
    <div className="flex w-full flex-col items-start gap-2">
      {message.parts.map((part, i) => {
        if (part.type === "text") {
          return (
            <div
              key={i}
              className="rounded-2xl rounded-bl-md bg-card border border-border px-4 py-2.5 text-sm max-w-full overflow-x-auto"
            >
              <TextPart text={part.text} />
            </div>
          );
        }
        const toolInfo = extractToolInfo(
          part as { type: string; [key: string]: unknown },
        );
        if (toolInfo) {
          return (
            <ToolCallDisplay
              key={i}
              toolName={toolInfo.toolName}
              state={toolInfo.state}
              input={toolInfo.input}
              output={toolInfo.output}
              errorText={toolInfo.errorText}
            />
          );
        }
        return null;
      })}
    </div>
  );
};

const TextPart: FC<{ text: string }> = ({ text }) => {
  if (!text.trim()) return null;
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <Markdown
        components={{
          img: ({ src, alt, ...props }) =>
            src ? <img src={src} alt={alt ?? ""} {...props} /> : null,
        }}
      >
        {text}
      </Markdown>
    </div>
  );
};

/* ---------- Tool call cards ---------- */

const TOOL_META: Record<
  string,
  { running: string; done: string; icon: typeof FlameIcon; color: string }
> = {
  solve_thermal: {
    running: "Running PDE solver...",
    done: "PDE Solve Complete",
    icon: FlameIcon,
    color: "text-orange-500",
  },
  evaluate_design: {
    running: "Evaluating design...",
    done: "Design Evaluation",
    icon: ThermometerIcon,
    color: "text-blue-500",
  },
  visualize: {
    running: "Generating heatmap...",
    done: "Heatmap",
    icon: LayersIcon,
    color: "text-purple-500",
  },
};

const ToolCallDisplay: FC<{
  toolName: string;
  state: string;
  input: unknown;
  output?: unknown;
  errorText?: string;
}> = ({ toolName, state, output, errorText }) => {
  const meta = TOOL_META[toolName] || {
    running: `Running ${toolName}...`,
    done: toolName,
    icon: ZapIcon,
    color: "text-muted-foreground",
  };
  const Icon = meta.icon;

  const isDone = state === "output-available";
  const isError = state === "output-error";
  const isRunning = !isDone && !isError;

  let resultObj: Record<string, unknown> | undefined;
  if (isDone && output) {
    try {
      resultObj =
        typeof output === "string"
          ? JSON.parse(output)
          : (output as Record<string, unknown>);
    } catch {
      resultObj = undefined;
    }
  }

  const hasError = isError || !!resultObj?.error;

  return (
    <div className="w-full rounded-xl border border-border bg-card overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-border bg-muted/40">
        {isRunning ? (
          <Loader2Icon className={`h-4 w-4 animate-spin ${meta.color}`} />
        ) : (
          <Icon
            className={`h-4 w-4 ${hasError ? "text-red-500" : meta.color}`}
          />
        )}
        <span className="text-xs font-semibold tracking-wide">
          {isRunning ? meta.running : isDone ? meta.done : `${toolName} failed`}
        </span>
        {isDone && !hasError && (
          <span className="ml-auto text-[10px] text-green-500 font-medium uppercase tracking-wider">
            Done
          </span>
        )}
        {hasError && (
          <span className="ml-auto text-[10px] text-red-500 font-medium uppercase tracking-wider">
            Error
          </span>
        )}
      </div>

      {/* Running state */}
      {isRunning && (
        <div className="px-4 py-3">
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-orange-500 to-red-500 animate-pulse" />
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            {toolName === "solve_thermal" &&
              "Assembling PDE system and running red-black SOR iterations..."}
            {toolName === "evaluate_design" &&
              "Computing temperature metrics, hot spots, and constraint checks..."}
            {toolName === "visualize" &&
              "Rendering temperature distribution heatmap..."}
          </p>
        </div>
      )}

      {/* Error */}
      {isError && errorText && (
        <div className="px-4 py-3 text-xs text-red-400 bg-red-500/5">
          {errorText}
        </div>
      )}

      {/* Results */}
      {isDone && resultObj && (
        <div className="p-4">
          {resultObj.error ? (
            <div className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">
              {String(resultObj.error)}
            </div>
          ) : (
            <>
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
                toolName,
              ) && (
                <pre className="text-xs overflow-x-auto whitespace-pre-wrap text-muted-foreground">
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

/* ---------- Result renderers ---------- */

const SolveResult: FC<{ result: Record<string, unknown> }> = ({ result }) => (
  <div className="space-y-3">
    <div className="grid grid-cols-3 gap-2">
      <Stat
        label="Iterations"
        value={String(result.iterations ?? "—")}
        sub="SOR sweeps"
      />
      <Stat
        label="Solve Time"
        value={`${Number(result.elapsed_seconds ?? 0).toFixed(2)}s`}
        sub="wall clock"
      />
      <Stat
        label="Grid"
        value={`${result.grid_size ?? "—"}²`}
        sub="interior pts"
      />
    </div>
    {typeof result.heatmap_url === "string" && (
      <div className="rounded-lg overflow-hidden border border-border shadow-inner">
        <img
          src={result.heatmap_url}
          alt="Temperature distribution"
          className="w-full"
        />
      </div>
    )}
  </div>
);

const EvaluateResult: FC<{ result: Record<string, unknown> }> = ({
  result,
}) => {
  const meets = result.meets_target;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Stat
          label="Peak Temp"
          value={Number(result.max_temperature ?? 0).toFixed(4)}
          highlight={meets === false}
        />
        <Stat
          label="Mean Temp"
          value={Number(result.mean_temperature ?? 0).toFixed(4)}
        />
        <Stat
          label="Compliance"
          value={Number(result.thermal_compliance ?? 0).toFixed(6)}
          sub="lower = better"
        />
      </div>
      {meets !== undefined && (
        <div
          className={`flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg ${
            meets
              ? "bg-green-500/10 text-green-400 border border-green-500/20"
              : "bg-red-500/10 text-red-400 border border-red-500/20"
          }`}
        >
          <div
            className={`h-2 w-2 rounded-full ${meets ? "bg-green-500" : "bg-red-500"}`}
          />
          {meets
            ? `Target met — ${Number(result.margin ?? 0).toFixed(4)} margin`
            : `Target exceeded by ${Math.abs(Number(result.margin ?? 0)).toFixed(4)} — iterating...`}
        </div>
      )}

      {Array.isArray(result.hot_spots) && result.hot_spots.length > 0 && (
        <div className="text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground">Hot spots: </span>
          {(result.hot_spots as Array<{ x: number; y: number; temperature: number }>)
            .slice(0, 3)
            .map((h, i) => (
              <span key={i}>
                ({h.x.toFixed(2)}, {h.y.toFixed(2)}){" "}
                <span className="text-orange-400">{h.temperature.toFixed(3)}</span>
                {i < 2 ? ", " : ""}
              </span>
            ))}
        </div>
      )}
    </div>
  );
};

const VisualizeResult: FC<{ result: Record<string, unknown> }> = ({
  result,
}) => {
  const url = result.heatmap_url as string | undefined;
  if (url) {
    return (
      <div className="rounded-lg overflow-hidden border border-border shadow-inner">
        <img src={url} alt="Temperature heatmap" className="w-full" />
      </div>
    );
  }
  return (
    <div className="text-xs text-muted-foreground">Visualization generated</div>
  );
};

const Stat: FC<{
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}> = ({ label, value, sub, highlight }) => (
  <div
    className={`rounded-lg px-3 py-2 ${highlight ? "bg-red-500/10 border border-red-500/20" : "bg-muted/50"}`}
  >
    <div className="text-muted-foreground text-[10px] uppercase tracking-wider font-medium">
      {label}
    </div>
    <div
      className={`font-mono text-sm font-bold mt-0.5 ${highlight ? "text-red-400" : "text-foreground"}`}
    >
      {value}
    </div>
    {sub && (
      <div className="text-[9px] text-muted-foreground/60 mt-0.5">{sub}</div>
    )}
  </div>
);
