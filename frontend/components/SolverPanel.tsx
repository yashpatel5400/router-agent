"use client";

import type { SolverSnapshot } from "./Chat";
import {
  Loader2Icon,
  SettingsIcon,
  GridIcon,
  GaugeIcon,
  TargetIcon,
  IterationCcwIcon,
  ClockIcon,
  CheckCircle2Icon,
  XCircleIcon,
  ChevronRightIcon,
  TrendingDownIcon,
} from "lucide-react";
import { FC, useMemo } from "react";

export const SolverPanel: FC<{ snapshots: SolverSnapshot[] }> = ({
  snapshots,
}) => {
  const latest = snapshots[snapshots.length - 1];
  const hasSnapshots = snapshots.length > 0;

  return (
    <aside className="w-80 shrink-0 border-l border-border bg-card/50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <SettingsIcon className="h-4 w-4 text-orange-500" />
          <h2 className="text-xs font-semibold uppercase tracking-wider">
            Solver Parameters
          </h2>
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          Agent-selected configuration for each solve
        </p>
      </div>

      {/* Pinned top: current config + convergence chart (or empty state) */}
      <div className="shrink-0">
        {hasSnapshots && (
          <>
            <CurrentConfig
              snapshot={latest}
              prev={snapshots.length > 1 ? snapshots[snapshots.length - 2] : undefined}
            />
            {snapshots.some((s) => s.evaluation) && (
              <ConvergenceChart snapshots={snapshots} />
            )}
          </>
        )}
      </div>

      {/* Scrollable area: empty state or parameter history */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {!hasSnapshots ? (
          <EmptyPanel />
        ) : snapshots.length > 0 ? (
          <div className="px-4 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Parameter History
            </div>
            <div className="space-y-0">
              {snapshots.map((snap, i) => (
                <TimelineEntry
                  key={i}
                  snapshot={snap}
                  isLatest={i === snapshots.length - 1}
                  prev={i > 0 ? snapshots[i - 1] : undefined}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  );
};

const ConvergenceChart: FC<{ snapshots: SolverSnapshot[] }> = ({ snapshots }) => {
  const data = useMemo(() => {
    const points: { iteration: number; peak: number; target?: number }[] = [];
    for (const snap of snapshots) {
      if (snap.evaluation) {
        points.push({
          iteration: snap.iteration,
          peak: snap.evaluation.peak_temp,
          target: snap.evaluation.target,
        });
      }
    }
    return points;
  }, [snapshots]);

  if (data.length < 1) return null;

  const target = data.find((d) => d.target !== undefined)?.target;
  const peaks = data.map((d) => d.peak);
  const allVals = target !== undefined ? [...peaks, target] : peaks;
  const yMin = Math.min(...allVals) * 0.9;
  const yMax = Math.max(...allVals) * 1.1;
  const yRange = yMax - yMin || 1;

  const W = 240;
  const H = 80;
  const padL = 36;
  const padR = 8;
  const padT = 6;
  const padB = 16;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const xStep = data.length > 1 ? plotW / (data.length - 1) : plotW / 2;
  const pts = data.map((d, i) => ({
    x: padL + (data.length > 1 ? i * xStep : plotW / 2),
    y: padT + plotH - ((d.peak - yMin) / yRange) * plotH,
    peak: d.peak,
  }));

  const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  const targetY = target !== undefined
    ? padT + plotH - ((target - yMin) / yRange) * plotH
    : null;

  const latestMet = data[data.length - 1]?.target !== undefined &&
    data[data.length - 1].peak <= (data[data.length - 1].target ?? Infinity);

  const tickCount = 3;
  const yTicks = Array.from({ length: tickCount }, (_, i) => {
    const frac = i / (tickCount - 1);
    const val = yMax - frac * yRange;
    const y = padT + frac * plotH;
    return { val, y };
  });

  return (
    <div className="px-4 py-3 border-b border-border">
      <div className="flex items-center gap-2 mb-2">
        <TrendingDownIcon className="h-3.5 w-3.5 text-orange-500" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Peak Temperature
        </span>
        {target !== undefined && (
          <span
            className={`ml-auto text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded-full ${
              latestMet
                ? "text-green-500 bg-green-500/10"
                : "text-red-400 bg-red-500/10"
            }`}
          >
            target: {target}
          </span>
        )}
      </div>
      <svg width={W} height={H} className="w-full" viewBox={`0 0 ${W} ${H}`}>
        {/* Y-axis grid + labels */}
        {yTicks.map((tick, i) => (
          <g key={i}>
            <line
              x1={padL}
              x2={W - padR}
              y1={tick.y}
              y2={tick.y}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={0.5}
            />
            <text
              x={padL - 4}
              y={tick.y + 3}
              textAnchor="end"
              fill="#71717a"
              fontSize={8}
              fontFamily="monospace"
            >
              {tick.val.toFixed(2)}
            </text>
          </g>
        ))}

        {/* Target line */}
        {targetY !== null && (
          <line
            x1={padL}
            x2={W - padR}
            y1={targetY}
            y2={targetY}
            stroke={latestMet ? "#22c55e" : "#ef4444"}
            strokeWidth={1}
            strokeDasharray="4 3"
            opacity={0.6}
          />
        )}

        {/* Peak temp line */}
        <path
          d={linePath}
          fill="none"
          stroke="#f97316"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data dots */}
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={3} fill="#0a0a0a" stroke="#f97316" strokeWidth={1.5} />
            {/* X-axis label */}
            <text
              x={p.x}
              y={H - 2}
              textAnchor="middle"
              fill="#71717a"
              fontSize={7}
              fontFamily="monospace"
            >
              #{data[i].iteration}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
};

const EmptyPanel: FC = () => (
  <div className="flex flex-col items-center justify-center h-full text-center px-6 gap-3">
    <div className="rounded-xl bg-muted/50 p-4">
      <SettingsIcon className="h-8 w-8 text-muted-foreground/40" />
    </div>
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">
        No solves yet
      </p>
      <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
        Start a thermal design problem and the agent will select solver
        parameters. Its choices will appear here in real time.
      </p>
    </div>
  </div>
);

const CurrentConfig: FC<{ snapshot: SolverSnapshot; prev?: SolverSnapshot }> = ({
  snapshot,
  prev,
}) => {
  const { params, result, evaluation, isRunning } = snapshot;
  const passed = evaluation?.meets_target === true;
  const failed = evaluation !== undefined && !evaluation.meets_target;

  const gridChanged = prev !== undefined && params.grid_size !== prev.params.grid_size;
  const omegaChanged = prev !== undefined && params.omega !== prev.params.omega;
  const tolChanged = prev !== undefined && params.tol !== prev.params.tol;
  const itersChanged = prev !== undefined && params.max_iters !== prev.params.max_iters;

  return (
    <div className="p-4 border-b border-border">
      <div className="flex items-center gap-2 mb-3">
        {isRunning ? (
          <Loader2Icon className="h-3.5 w-3.5 animate-spin text-orange-500" />
        ) : passed ? (
          <CheckCircle2Icon className="h-3.5 w-3.5 text-green-500" />
        ) : failed ? (
          <XCircleIcon className="h-3.5 w-3.5 text-red-500" />
        ) : (
          <CheckCircle2Icon className="h-3.5 w-3.5 text-green-500" />
        )}
        <span className="text-[10px] font-semibold uppercase tracking-wider">
          {isRunning ? "Active Solve" : `Solve #${snapshot.iteration}`}
        </span>
        {passed && (
          <span className="ml-auto text-[9px] font-semibold text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full">
            Target Met
          </span>
        )}
        {failed && (
          <span className="ml-auto text-[9px] font-semibold text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full">
            Target Missed
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <ParamCard
          icon={GridIcon}
          label="Grid"
          value={`${params.grid_size}×${params.grid_size}`}
          sub={`${params.grid_size * params.grid_size} pts`}
          changed={gridChanged}
          delta={gridChanged ? (params.grid_size > prev!.params.grid_size ? "↑" : "↓") : undefined}
        />
        <ParamCard
          icon={GaugeIcon}
          label="Omega (ω)"
          value={params.omega.toFixed(3)}
          sub={
            params.omega < 1.0
              ? "under-relaxed"
              : params.omega < 1.5
                ? "moderate"
                : params.omega < 1.8
                  ? "standard"
                  : "aggressive"
          }
          changed={omegaChanged}
          delta={omegaChanged ? (params.omega > prev!.params.omega ? "↑" : "↓") : undefined}
        />
        <ParamCard
          icon={TargetIcon}
          label="Tolerance"
          value={formatTol(params.tol)}
          sub={
            params.tol >= 1e-4
              ? "exploratory"
              : params.tol >= 1e-6
                ? "production"
                : "high-accuracy"
          }
          changed={tolChanged}
          delta={tolChanged ? (params.tol < prev!.params.tol ? "tighter" : "looser") : undefined}
        />
        <ParamCard
          icon={IterationCcwIcon}
          label="Max Iters"
          value={params.max_iters.toLocaleString()}
          sub="iteration cap"
          changed={itersChanged}
          delta={itersChanged ? (params.max_iters > prev!.params.max_iters ? "↑" : "↓") : undefined}
        />
      </div>

      {/* Result stats — always rendered to keep layout stable */}
      <div className="mt-3 grid grid-cols-3 gap-1.5">
        <MiniStat
          label="Converged in"
          value={result && !isRunning ? `${result.iterations}` : "—"}
          unit={result && !isRunning ? "iters" : undefined}
          dimmed={!result || isRunning}
        />
        <MiniStat
          label="Time"
          value={result && !isRunning ? result.elapsed_seconds.toFixed(2) : "—"}
          unit={result && !isRunning ? "s" : undefined}
          dimmed={!result || isRunning}
        />
        <MiniStat
          label="Residual"
          value={result && !isRunning ? result.final_residual.toExponential(1) : "—"}
          dimmed={!result || isRunning}
        />
      </div>

      {isRunning && (
        <div className="mt-2 h-1 w-full rounded-full bg-muted overflow-hidden">
          <div className="h-full w-2/5 rounded-full bg-gradient-to-r from-orange-500 to-red-500 animate-[pulse_1.5s_ease-in-out_infinite]" />
        </div>
      )}
    </div>
  );
};

const TimelineEntry: FC<{
  snapshot: SolverSnapshot;
  isLatest: boolean;
  prev?: SolverSnapshot;
}> = ({ snapshot, isLatest, prev }) => {
  const { params, result, evaluation, isRunning } = snapshot;
  const changes = prev ? getParamChanges(prev.params, params) : [];

  const passed = evaluation?.meets_target === true;
  const failed = evaluation !== undefined && !evaluation.meets_target;

  return (
    <div className="flex gap-3">
      {/* Timeline connector */}
      <div className="flex flex-col items-center w-5 shrink-0">
        {isRunning ? (
          <div className="w-2.5 h-2.5 rounded-full border-2 border-orange-500 bg-orange-500/20 animate-pulse shrink-0" />
        ) : passed ? (
          <CheckCircle2Icon className="h-3.5 w-3.5 text-green-500 shrink-0" />
        ) : failed ? (
          <XCircleIcon className="h-3.5 w-3.5 text-red-500 shrink-0" />
        ) : (
          <div
            className={`w-2.5 h-2.5 rounded-full border-2 shrink-0 ${
              isLatest
                ? "border-orange-500 bg-orange-500"
                : "border-muted-foreground/30 bg-muted"
            }`}
          />
        )}
        {!isLatest && (
          <div className="w-px flex-1 bg-border min-h-[16px]" />
        )}
      </div>

      {/* Content */}
      <div className={`pb-3 flex-1 min-w-0 ${isLatest ? "" : "opacity-60"}`}>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold">
            Solve #{snapshot.iteration}
          </span>
          {isRunning && (
            <Loader2Icon className="h-2.5 w-2.5 animate-spin text-orange-500" />
          )}
          {passed && (
            <span className="text-[8px] font-semibold uppercase tracking-wider text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded-full">
              Pass
            </span>
          )}
          {failed && (
            <span className="text-[8px] font-semibold uppercase tracking-wider text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded-full">
              Fail
            </span>
          )}
        </div>
        <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">
          {params.grid_size}² · ω={params.omega} · tol={formatTol(params.tol)}
        </div>
        {evaluation && (
          <div className={`text-[10px] mt-0.5 ${passed ? "text-green-500/70" : "text-red-500/70"}`}>
            peak={evaluation.peak_temp.toFixed(3)}
            {evaluation.target !== undefined && ` / target=${evaluation.target}`}
          </div>
        )}
        {result && (
          <div className="text-[10px] text-muted-foreground/70 mt-0.5 flex items-center gap-1">
            <ClockIcon className="h-2.5 w-2.5" />
            {result.iterations} iters · {result.elapsed_seconds.toFixed(2)}s
          </div>
        )}
        {changes.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {changes.map((c) => (
              <span
                key={c.param}
                className="inline-flex items-center gap-0.5 text-[9px] bg-orange-500/10 text-orange-400 px-1.5 py-0.5 rounded-full"
              >
                <ChevronRightIcon className="h-2 w-2" />
                {c.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const ParamCard: FC<{
  icon: typeof GridIcon;
  label: string;
  value: string;
  sub?: string;
  changed?: boolean;
  delta?: string;
}> = ({ icon: Icon, label, value, sub, changed, delta }) => (
  <div
    className={`rounded-lg px-3 py-2 transition-all duration-500 ${
      changed
        ? "bg-orange-500/10 border border-orange-500/40 shadow-[0_0_8px_rgba(249,115,22,0.15)]"
        : "bg-muted/50"
    }`}
  >
    <div className="flex items-center gap-1.5 mb-1">
      <Icon className={`h-3 w-3 ${changed ? "text-orange-500" : "text-muted-foreground"}`} />
      <span
        className={`text-[9px] uppercase tracking-wider font-medium ${
          changed ? "text-orange-500" : "text-muted-foreground"
        }`}
      >
        {label}
      </span>
      {changed && delta && (
        <span className="ml-auto text-[9px] font-bold text-orange-400 bg-orange-500/20 px-1.5 py-0.5 rounded-full animate-in fade-in">
          {delta}
        </span>
      )}
    </div>
    <div className={`font-mono text-sm font-bold ${changed ? "text-orange-400" : "text-foreground"}`}>
      {value}
    </div>
    {sub && (
      <div className={`text-[9px] mt-0.5 ${changed ? "text-orange-500/60" : "text-muted-foreground/60"}`}>
        {sub}
      </div>
    )}
  </div>
);

const MiniStat: FC<{
  label: string;
  value: string;
  unit?: string;
  dimmed?: boolean;
}> = ({ label, value, unit, dimmed }) => (
  <div className="rounded-md bg-muted/30 px-2 py-1.5 text-center">
    <div className="text-[8px] text-muted-foreground uppercase tracking-wider">
      {label}
    </div>
    <div className={`font-mono text-[11px] font-bold ${dimmed ? "text-muted-foreground/40" : "text-foreground"}`}>
      {value}
      {unit && (
        <span className="text-[8px] text-muted-foreground ml-0.5 font-normal">
          {unit}
        </span>
      )}
    </div>
  </div>
);

function formatTol(tol: number): string {
  const exp = Math.round(Math.log10(tol));
  return `1e${exp}`;
}

type ParamChange = { param: string; label: string };

function getParamChanges(
  prev: SolverSnapshot["params"],
  curr: SolverSnapshot["params"],
): ParamChange[] {
  const changes: ParamChange[] = [];
  if (curr.grid_size !== prev.grid_size) {
    const dir = curr.grid_size > prev.grid_size ? "↑" : "↓";
    changes.push({
      param: "grid",
      label: `grid ${dir} ${curr.grid_size}²`,
    });
  }
  if (curr.omega !== prev.omega) {
    const dir = curr.omega > prev.omega ? "↑" : "↓";
    changes.push({
      param: "omega",
      label: `ω ${dir} ${curr.omega}`,
    });
  }
  if (curr.tol !== prev.tol) {
    const dir = curr.tol < prev.tol ? "tighter" : "looser";
    changes.push({
      param: "tol",
      label: `tol ${dir}`,
    });
  }
  if (curr.max_iters !== prev.max_iters) {
    const dir = curr.max_iters > prev.max_iters ? "↑" : "↓";
    changes.push({
      param: "max_iters",
      label: `iters ${dir} ${curr.max_iters}`,
    });
  }
  return changes;
}
