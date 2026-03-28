"use client";

import type { SolverSnapshot } from "./Chat";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ImageIcon,
  Loader2Icon,
} from "lucide-react";
import { FC, useEffect, useState, useRef } from "react";

export const HeatmapViewer: FC<{ snapshots: SolverSnapshot[] }> = ({
  snapshots,
}) => {
  const withHeatmaps = snapshots.filter((s) => s.heatmap_url);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const prevCountRef = useRef(0);

  useEffect(() => {
    if (withHeatmaps.length > prevCountRef.current) {
      setSelectedIdx(withHeatmaps.length - 1);
    }
    prevCountRef.current = withHeatmaps.length;
  }, [withHeatmaps.length]);

  const activelyRunning = snapshots.some((s) => s.isRunning);

  if (withHeatmaps.length === 0) {
    return (
      <div className="shrink-0 border-b border-border bg-card/30 flex items-center justify-center px-6 py-8">
        <div className="flex flex-col items-center gap-2 text-center">
          {activelyRunning ? (
            <>
              <Loader2Icon className="h-6 w-6 animate-spin text-orange-500" />
              <p className="text-xs text-muted-foreground">
                Computing solution...
              </p>
            </>
          ) : (
            <>
              <ImageIcon className="h-6 w-6 text-muted-foreground/30" />
              <p className="text-xs text-muted-foreground/60">
                Solution heatmaps will appear here
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  const current = withHeatmaps[selectedIdx];
  if (!current) return null;

  const canPrev = selectedIdx > 0;
  const canNext = selectedIdx < withHeatmaps.length - 1;

  return (
    <div className="shrink-0 border-b border-border bg-black/20 flex flex-col">
      {/* Image area */}
      <div className="relative flex items-center justify-center overflow-hidden"
           style={{ height: "min(40vh, 400px)" }}>
        <img
          src={current.heatmap_url}
          alt={`Solve #${current.iteration} temperature distribution`}
          className="h-full w-auto max-w-full object-contain"
        />

        {/* Prev button */}
        {canPrev && (
          <button
            onClick={() => setSelectedIdx((i) => i - 1)}
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80 transition-colors backdrop-blur-sm"
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </button>
        )}

        {/* Next button */}
        {canNext && (
          <button
            onClick={() => setSelectedIdx((i) => i + 1)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80 transition-colors backdrop-blur-sm"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        )}

        {/* Label overlay */}
        <div className="absolute top-2 left-2 flex items-center gap-2">
          <span className="text-[10px] font-semibold bg-black/60 text-white px-2 py-1 rounded-md backdrop-blur-sm">
            Solve #{current.iteration} of {withHeatmaps.length}
          </span>
          {current.evaluation && (
            <span
              className={`text-[10px] font-semibold px-2 py-1 rounded-md backdrop-blur-sm ${
                current.evaluation.meets_target
                  ? "bg-green-500/80 text-white"
                  : "bg-red-500/80 text-white"
              }`}
            >
              {current.evaluation.meets_target ? "Pass" : "Fail"}
              {" \u2014 "}peak {current.evaluation.peak_temp.toFixed(3)}
            </span>
          )}
        </div>

        {/* Grid info */}
        <div className="absolute top-2 right-2">
          <span className="text-[10px] font-mono bg-black/60 text-white/80 px-2 py-1 rounded-md backdrop-blur-sm">
            {current.params.grid_size}x{current.params.grid_size} | ω={current.params.omega}
          </span>
        </div>
      </div>

      {/* Dot indicators */}
      {withHeatmaps.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 py-2 bg-black/10">
          {withHeatmaps.map((snap, i) => (
            <button
              key={i}
              onClick={() => setSelectedIdx(i)}
              className={`transition-all rounded-full ${
                i === selectedIdx
                  ? "w-5 h-2 bg-orange-500"
                  : snap.evaluation?.meets_target
                    ? "w-2 h-2 bg-green-500/50 hover:bg-green-500"
                    : "w-2 h-2 bg-muted-foreground/30 hover:bg-muted-foreground/60"
              }`}
              title={`Solve #${snap.iteration}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};
