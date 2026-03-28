"use client";

import { useChat, type UIMessage } from "@ai-sdk/react";
import { useAISDKRuntime } from "@assistant-ui/react-ai-sdk";
import {
  AssistantRuntimeProvider,
  makeAssistantToolUI,
} from "@assistant-ui/react";
import {
  Loader2Icon,
  ThermometerIcon,
  LayersIcon,
  FlameIcon,
} from "lucide-react";
import { type FC, useRef, useEffect, useCallback, useState, forwardRef, useImperativeHandle } from "react";
import { HeatmapViewer } from "./HeatmapViewer";
import { Thread } from "./assistant-ui/thread";

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
  heatmap_url?: string;
  temperature_field?: number[][];
  sources?: { x: number; y: number; intensity: number; radius: number }[];
  conductivity_regions?: { x: number; y: number; radius: number; value: number }[];
  isRunning: boolean;
};

type ChatProps = {
  onSolverUpdate?: (snapshots: SolverSnapshot[]) => void;
  snapshots?: SolverSnapshot[];
};

const MIN_VIEWER_H = 120;
const MAX_VIEWER_H = 800;
const DEFAULT_VIEWER_H = 350;

export const Chat = forwardRef<ChatHandle, ChatProps>(function Chat(
  { onSolverUpdate, snapshots: externalSnapshots },
  ref,
) {
  const [chatKey, setChatKey] = useState(0);
  const chat = useChat({ id: `chat-${chatKey}` });
  const { messages, setMessages } = chat;
  const runtime = useAISDKRuntime(chat);
  const [viewerHeight, setViewerHeight] = useState(DEFAULT_VIEWER_H);
  const draggingRef = useRef(false);
  const startYRef = useRef(0);
  const startHRef = useRef(0);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    draggingRef.current = true;
    startYRef.current = e.clientY;
    startHRef.current = viewerHeight;

    const onMove = (ev: MouseEvent) => {
      if (!draggingRef.current) return;
      const delta = ev.clientY - startYRef.current;
      setViewerHeight(Math.max(MIN_VIEWER_H, Math.min(MAX_VIEWER_H, startHRef.current + delta)));
    };

    const onUp = () => {
      draggingRef.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [viewerHeight]);

  useImperativeHandle(ref, () => ({
    reset() {
      setMessages([]);
      onSolverUpdate?.([]);
      setChatKey((k) => k + 1);
    },
  }));

  const prevSnapshotKeyRef = useRef("");
  useEffect(() => {
    if (!onSolverUpdate) return;
    const snapshots = extractSolverSnapshots(messages);
    const key = snapshots
      .map((s) => `${s.iteration}:${s.isRunning}:${s.result?.iterations ?? ""}:${s.evaluation?.meets_target ?? ""}:${s.heatmap_url ?? ""}:${s.temperature_field ? "tf" : ""}`)
      .join("|");
    if (key !== prevSnapshotKeyRef.current) {
      prevSnapshotKeyRef.current = key;
      onSolverUpdate(snapshots);
    }
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="flex flex-1 min-w-0 min-h-0 flex-col overflow-hidden">
        {/* Fixed heatmap viewer at top — resizable */}
        {messages.length > 0 && externalSnapshots && (
          <HeatmapViewer
            snapshots={externalSnapshots}
            height={viewerHeight}
            onResizeStart={handleResizeStart}
          />
        )}

        <div className="relative flex-1 min-h-0">
          <div className="absolute inset-0">
            <Thread />
          </div>
        </div>

        {/* Tool UI registrations (render nothing visible, just register with runtime) */}
        <SolveThermalToolUI />
        <EvaluateDesignToolUI />
        <VisualizeToolUI />
      </div>
    </AssistantRuntimeProvider>
  );
});

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
      heatmap_url: outputObj?.heatmap_url as string | undefined,
      temperature_field: outputObj?.temperature_field as number[][] | undefined,
      sources: outputObj?.sources as SolverSnapshot["sources"] | undefined,
      conductivity_regions: outputObj?.conductivity_regions as SolverSnapshot["conductivity_regions"] | undefined,
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

/* ---------- assistant-ui Tool UI registrations ---------- */

function parseToolResult(result: unknown): Record<string, unknown> | undefined {
  if (!result) return undefined;
  try {
    return typeof result === "string"
      ? JSON.parse(result)
      : (result as Record<string, unknown>);
  } catch {
    return undefined;
  }
}

function ToolCard({
  icon: Icon,
  label,
  color,
  runningText,
  status,
  result,
  children,
}: {
  icon: typeof FlameIcon;
  label: string;
  color: string;
  runningText: string;
  status: { type: string };
  result?: unknown;
  children?: React.ReactNode;
}) {
  const isRunning = status.type === "running" || status.type === "requires-action";
  const resultObj = parseToolResult(result);
  const hasError = status.type === "incomplete" || !!resultObj?.error;

  return (
    <div className="w-full rounded-xl border border-border bg-card overflow-hidden shadow-sm my-1">
      <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-border bg-muted/40">
        {isRunning ? (
          <Loader2Icon className={`h-4 w-4 animate-spin ${color}`} />
        ) : (
          <Icon className={`h-4 w-4 ${hasError ? "text-red-500" : color}`} />
        )}
        <span className="text-xs font-semibold tracking-wide">
          {isRunning ? `${label}...` : label}
        </span>
        {status.type === "complete" && !hasError && (
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

      {isRunning && (
        <div className="px-4 py-3">
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-orange-500 to-red-500 animate-pulse" />
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">{runningText}</p>
        </div>
      )}

      {resultObj?.error != null && (
        <div className="px-4 py-3 text-xs text-red-400 bg-red-500/5">
          {String(resultObj.error)}
        </div>
      )}

      {status.type === "complete" && resultObj && !resultObj.error && (
        <div className="p-4">{children}</div>
      )}
    </div>
  );
}

const SolveThermalToolUI = makeAssistantToolUI<Record<string, unknown>, unknown>({
  toolName: "solve_thermal",
  render: ({ result, status }) => (
    <ToolCard
      icon={FlameIcon}
      label="PDE Solve Complete"
      color="text-orange-500"
      runningText="Assembling PDE system and running red-black SOR iterations..."
      status={status}
      result={result}
    >
      {parseToolResult(result) && <SolveResult result={parseToolResult(result)!} />}
    </ToolCard>
  ),
});

const EvaluateDesignToolUI = makeAssistantToolUI<Record<string, unknown>, unknown>({
  toolName: "evaluate_design",
  render: ({ result, status }) => (
    <ToolCard
      icon={ThermometerIcon}
      label="Design Evaluation"
      color="text-blue-500"
      runningText="Computing temperature metrics, hot spots, and constraint checks..."
      status={status}
      result={result}
    >
      {parseToolResult(result) && <EvaluateResult result={parseToolResult(result)!} />}
    </ToolCard>
  ),
});

const VisualizeToolUI = makeAssistantToolUI<Record<string, unknown>, unknown>({
  toolName: "visualize",
  render: ({ result, status }) => (
    <ToolCard
      icon={LayersIcon}
      label="Heatmap"
      color="text-purple-500"
      runningText="Rendering temperature distribution heatmap..."
      status={status}
      result={result}
    >
      {parseToolResult(result) && <VisualizeResult result={parseToolResult(result)!} />}
    </ToolCard>
  ),
});

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
    {(result.temperature_field != null || typeof result.heatmap_url === "string") && (
      <div className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
        Heatmap shown in viewer above
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
  return (
    <div className="text-xs text-muted-foreground">Heatmap shown in viewer above</div>
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
