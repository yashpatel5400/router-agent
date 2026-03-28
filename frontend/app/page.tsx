"use client";

import { Chat, type ChatHandle, type SolverSnapshot } from "@/components/Chat";
import { SolverPanel } from "@/components/SolverPanel";
import { useRef, useState, useCallback } from "react";

export default function Home() {
  const chatRef = useRef<ChatHandle>(null);
  const [snapshots, setSnapshots] = useState<SolverSnapshot[]>([]);

  function handleReset() {
    chatRef.current?.reset();
  }

  const handleSolverUpdate = useCallback((s: SolverSnapshot[]) => {
    setSnapshots(s);
  }, []);

  return (
    <main className="flex h-screen flex-col">
      <header className="border-b border-border px-4 py-3 flex items-center gap-3 bg-card shrink-0">
        <button
          onClick={handleReset}
          className="rounded-lg bg-gradient-to-br from-orange-500 to-red-600 p-1.5 hover:opacity-80 transition-opacity cursor-pointer"
          title="New chat"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
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
        </button>
        <button
          onClick={handleReset}
          className="text-sm font-semibold hover:text-orange-400 transition-colors cursor-pointer"
          title="New chat"
        >
          PDE Thermal Design Optimizer
        </button>
        <span className="text-xs text-muted-foreground ml-auto">
          Powered by 2D Poisson Solver + SOR
        </span>
      </header>
      <div className="flex flex-1 min-h-0">
        <Chat ref={chatRef} onSolverUpdate={handleSolverUpdate} />
        <SolverPanel snapshots={snapshots} />
      </div>
    </main>
  );
}
