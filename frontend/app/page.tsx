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
    <main className="flex h-screen max-h-screen flex-col overflow-hidden">
      <header className="border-b border-border px-4 py-3 flex items-center gap-3 bg-card shrink-0">
        <button
          onClick={handleReset}
          className="hover:opacity-80 transition-opacity cursor-pointer"
          title="New chat"
        >
          <img src="/logo.png" alt="PDE Thermal" className="h-8 w-auto rounded-lg" />
        </button>
        <button
          onClick={handleReset}
          className="text-sm font-semibold hover:text-orange-400 transition-colors cursor-pointer"
          title="New chat"
        >
          PDE Thermal Design Optimizer
        </button>
      </header>
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <Chat ref={chatRef} onSolverUpdate={handleSolverUpdate} snapshots={snapshots} />
        <SolverPanel snapshots={snapshots} />
      </div>
    </main>
  );
}
