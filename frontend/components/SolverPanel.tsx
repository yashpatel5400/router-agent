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
} from "lucide-react";
import { FC } from "react";

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

      <div className="flex-1 overflow-y-auto">
        {!hasSnapshots ? (
          <EmptyPanel />
        ) : (
          <>
            {/* Current config */}
            <CurrentConfig snapshot={latest} />

            {/* Timeline */}
            {snapshots.length > 0 && (
              <div className="px-4 pb-4">
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
            )}
          </>
        )}
      </div>
    </aside>
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

const CurrentConfig: FC<{ snapshot: SolverSnapshot }> = ({ snapshot }) => {
  const { params, result, evaluation, isRunning } = snapshot;
  const passed = evaluation?.meets_target === true;
  const failed = evaluation !== undefined && !evaluation.meets_target;

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
        />
        <ParamCard
          icon={IterationCcwIcon}
          label="Max Iters"
          value={params.max_iters.toLocaleString()}
          sub="iteration cap"
        />
      </div>

      {/* Result stats */}
      {result && !isRunning && (
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          <MiniStat
            label="Converged in"
            value={`${result.iterations}`}
            unit="iters"
          />
          <MiniStat
            label="Time"
            value={result.elapsed_seconds.toFixed(2)}
            unit="s"
          />
          <MiniStat
            label="Residual"
            value={result.final_residual.toExponential(1)}
          />
        </div>
      )}

      {isRunning && (
        <div className="mt-3 h-1 w-full rounded-full bg-muted overflow-hidden">
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
}> = ({ icon: Icon, label, value, sub }) => (
  <div className="rounded-lg bg-muted/50 px-3 py-2">
    <div className="flex items-center gap-1.5 mb-1">
      <Icon className="h-3 w-3 text-muted-foreground" />
      <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium">
        {label}
      </span>
    </div>
    <div className="font-mono text-sm font-bold text-foreground">{value}</div>
    {sub && (
      <div className="text-[9px] text-muted-foreground/60 mt-0.5">{sub}</div>
    )}
  </div>
);

const MiniStat: FC<{
  label: string;
  value: string;
  unit?: string;
}> = ({ label, value, unit }) => (
  <div className="rounded-md bg-muted/30 px-2 py-1.5 text-center">
    <div className="text-[8px] text-muted-foreground uppercase tracking-wider">
      {label}
    </div>
    <div className="font-mono text-[11px] font-bold text-foreground">
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
