"use client";

import {
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useComposerRuntime,
} from "@assistant-ui/react";
import { MarkdownTextPrimitive } from "@assistant-ui/react-markdown";
import {
  SendHorizontalIcon,
  ThermometerIcon,
  CpuIcon,
  ZapIcon,
  LayersIcon,
  ShieldIcon,
  FlameIcon,
} from "lucide-react";
import { FC } from "react";

const EXAMPLES = [
  {
    icon: CpuIcon,
    label: "Chip cooling challenge",
    prompt:
      "I have a high-power chip at (0.5, 0.5) with intensity 2000 and radius 0.08. The chip runs extremely hot. Target: keep peak temperature below 0.5. Suggest heat spreader placements to meet this target.",
  },
  {
    icon: FlameIcon,
    label: "Multi-source thermal management",
    prompt:
      "3 heat sources in a line: (0.3, 0.5) intensity 800, (0.5, 0.5) intensity 1200, (0.7, 0.5) intensity 800, all radius 0.06. Target: peak temp below 0.8. Design a cooling layout.",
  },
  {
    icon: ShieldIcon,
    label: "Edge-mounted power devices",
    prompt:
      "4 power devices near the edges: (0.2, 0.2), (0.2, 0.8), (0.8, 0.2), (0.8, 0.8), each intensity 600 radius 0.05. Target: peak temp below 0.4. They're close to the cool boundaries — can we exploit that?",
  },
  {
    icon: ZapIcon,
    label: "Dense power grid",
    prompt:
      "6 power devices in a 2x3 grid: (0.35,0.3), (0.35,0.5), (0.35,0.7), (0.65,0.3), (0.65,0.5), (0.65,0.7), each intensity 1000, radius 0.04. They're tightly packed and interact thermally. Target: peak temp below 0.6.",
  },
  {
    icon: ThermometerIcon,
    label: "Asymmetric heat load",
    prompt:
      "Two sources with very different intensities: (0.3, 0.5) at 2000 and (0.7, 0.5) at 200. Radius 0.07 each. Target: peak temp below 0.8. The design needs to handle the asymmetry.",
  },
  {
    icon: LayersIcon,
    label: "Central hot spot",
    prompt:
      "Single intense source at dead center (0.5, 0.5), intensity 3000, radius 0.1. Target: peak temp below 0.15. This is extremely challenging — maximum heat spreader coverage needed.",
  },
];

export const Thread: FC = () => {
  return (
    <ThreadPrimitive.Root className="flex h-full flex-col">
      <ThreadPrimitive.Viewport className="flex flex-1 flex-col overflow-y-auto scroll-smooth px-6 pt-4">
        <div className="mx-auto w-full max-w-2xl pb-4">
          <ThreadPrimitive.Empty>
            <EmptyState />
          </ThreadPrimitive.Empty>

          <ThreadPrimitive.Messages
            components={{
              UserMessage,
              AssistantMessage,
            }}
          />
        </div>
      </ThreadPrimitive.Viewport>

      <Composer />
    </ThreadPrimitive.Root>
  );
};

const EmptyState: FC = () => {
  const composer = useComposerRuntime();

  return (
    <div className="flex flex-col items-center gap-6 text-center max-w-xl mx-auto py-12">
      <div className="rounded-2xl shadow-xl shadow-orange-500/20 overflow-hidden">
        <img src="/logo.png" alt="PDE Thermal" className="h-20 w-20" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-foreground">
          Thermal Design Agent
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed max-w-md mx-auto">
          Describe a thermal problem and the agent will autonomously iterate on
          the design — solving PDEs, evaluating constraints, and optimizing
          layouts until your targets are met.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 w-full text-left">
        {EXAMPLES.map((ex) => (
          <button
            key={ex.label}
            className="group rounded-lg border border-border bg-card/50 p-3 hover:bg-accent hover:border-accent-foreground/20 transition-all cursor-pointer text-left"
            onClick={() => {
              composer.setText(ex.prompt);
              composer.send();
            }}
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
};

const Composer: FC = () => {
  return (
    <ComposerPrimitive.Root className="mx-auto flex w-full max-w-2xl items-end gap-2 rounded-t-xl border border-border bg-card p-3 shadow-sm">
      <ComposerPrimitive.Input
        autoFocus
        placeholder="Describe a thermal design problem..."
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
    <MessagePrimitive.Root className="mb-4 flex w-full flex-col items-end gap-1">
      <div className="rounded-2xl rounded-br-md bg-foreground px-4 py-2.5 text-sm text-background max-w-[80%]">
        <MessagePrimitive.Content />
      </div>
    </MessagePrimitive.Root>
  );
};

const AssistantMessage: FC = () => {
  return (
    <MessagePrimitive.Root className="mb-4 flex w-full flex-col items-start gap-2">
      <MessagePrimitive.Content
        components={{
          Text: MarkdownText,
          tools: {
            Fallback: ToolFallback,
          },
        }}
      />
    </MessagePrimitive.Root>
  );
};

const MarkdownText: FC<{ text: string }> = () => {
  return (
    <div className="rounded-2xl rounded-bl-md bg-card border border-border px-4 py-2.5 text-sm max-w-full overflow-x-auto">
      <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
        <MarkdownTextPrimitive />
      </div>
    </div>
  );
};

const ToolFallback: FC<{
  toolName: string;
  args: Record<string, unknown>;
  result?: unknown;
  status: { type: string };
}> = ({ toolName, status }) => {
  const isRunning = status.type === "running" || status.type === "requires-action";
  return (
    <div className="w-full rounded-xl border border-border bg-card overflow-hidden shadow-sm my-1">
      <div className="flex items-center gap-2.5 px-4 py-2.5 bg-muted/40">
        <div
          className={`h-2 w-2 rounded-full ${
            isRunning ? "bg-yellow-500 animate-pulse" : "bg-green-500"
          }`}
        />
        <span className="text-xs font-semibold tracking-wide">
          {isRunning ? `Running ${toolName}...` : toolName}
        </span>
      </div>
    </div>
  );
};
