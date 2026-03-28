import { Chat } from "@/components/Chat";

export default function Home() {
  return (
    <main className="flex h-screen flex-col">
      <header className="border-b border-border px-4 py-3 flex items-center gap-3 bg-card">
        <div className="rounded-lg bg-gradient-to-br from-orange-500 to-red-600 p-1.5">
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
        </div>
        <h1 className="text-sm font-semibold">PDE Thermal Design Optimizer</h1>
        <span className="text-xs text-muted-foreground ml-auto">
          Powered by 2D Poisson Solver + SOR
        </span>
      </header>
      <Chat />
    </main>
  );
}
