import { NextRequest } from "next/server";
import { execSync } from "child_process";
import { writeFileSync, readFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const REPO_ROOT = join(process.cwd(), "..");
const TMP_DIR = join(REPO_ROOT, "outputs");

function ensureTmpDir() {
  if (!existsSync(TMP_DIR)) {
    mkdirSync(TMP_DIR, { recursive: true });
  }
}

const SYSTEM_PROMPT = `You are a thermal design optimization assistant. You help users design and optimize thermal layouts by solving 2D heat equations (Poisson PDE).

You have tools to:
1. **solve_thermal**: Solve a thermal design problem. Takes a design spec with heat sources and conductivity, runs the PDE solver, returns the temperature field.
2. **evaluate_design**: Evaluate a solved design. Computes max/mean temperature, hot spots, thermal compliance, and checks against a target.

When the user describes a thermal problem:
1. Create a design JSON with appropriate sources, conductivity, and grid settings
2. Solve it using solve_thermal
3. Evaluate the result with evaluate_design
4. If the target isn't met, propose modifications and iterate
5. Explain your reasoning and the physics at each step

Keep responses concise. Focus on actionable insights from the simulation results.
The domain is [0,1]² with zero-temperature (Dirichlet) boundary conditions.
Source positions must be in (0,1). Intensity controls heat generation rate. Radius controls spatial extent.
Conductivity can be uniform or have high-conductivity regions to create thermal pathways.`;

const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "solve_thermal",
      description:
        "Solve a 2D steady-state heat equation for a thermal design. Returns solver stats and the temperature field.",
      parameters: {
        type: "object",
        properties: {
          grid_size: {
            type: "number",
            description: "Number of interior grid points per axis (default 31)",
          },
          sources: {
            type: "array",
            items: {
              type: "object",
              properties: {
                x: { type: "number", description: "x position in [0,1]" },
                y: { type: "number", description: "y position in [0,1]" },
                intensity: {
                  type: "number",
                  description: "Heat generation rate",
                },
                radius: {
                  type: "number",
                  description: "Spatial extent of the source",
                },
              },
              required: ["x", "y", "intensity", "radius"],
            },
            description: "List of heat sources",
          },
          conductivity: {
            type: "object",
            description:
              'Conductivity spec. Either {"type":"uniform","value":1.0} or {"type":"regions","base":1.0,"regions":[{"x":0.5,"y":0.5,"radius":0.1,"value":5.0}]}',
          },
          solver: {
            type: "object",
            properties: {
              omega: { type: "number" },
              tol: { type: "number" },
              max_iters: { type: "number" },
            },
          },
        },
        required: ["sources"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "evaluate_design",
      description:
        "Evaluate a solved thermal design. Returns max/mean temperature, hot spots, thermal compliance, and whether it meets a target.",
      parameters: {
        type: "object",
        properties: {
          result_path: {
            type: "string",
            description: "Path to the result JSON from solve_thermal",
          },
          target_max_temp: {
            type: "number",
            description: "Target maximum temperature threshold",
          },
        },
        required: ["result_path"],
      },
    },
  },
];

function executeSolveThermal(args: Record<string, unknown>): string {
  ensureTmpDir();
  const designId = `design_${Date.now()}`;
  const designPath = join(TMP_DIR, `${designId}.json`);
  const resultPath = join(TMP_DIR, `${designId}_result.json`);
  const heatmapPath = join(TMP_DIR, `${designId}_heatmap.png`);

  const design = {
    grid_size: args.grid_size || 31,
    sources: args.sources || [],
    conductivity: args.conductivity || { type: "uniform", value: 1.0 },
    solver: args.solver || { omega: 1.5, tol: 1e-6, max_iters: 10000 },
  };

  writeFileSync(designPath, JSON.stringify(design, null, 2));

  try {
    const pythonCmd = `cd "${REPO_ROOT}" && python tools/solve_thermal.py --design "${designPath}" --output "${resultPath}" --heatmap "${heatmapPath}" 2>&1`;
    execSync(pythonCmd, { timeout: 120000, encoding: "utf-8" });

    const resultRaw = readFileSync(resultPath, "utf-8");
    const result = JSON.parse(resultRaw);

    // Don't send the full temperature field to the LLM (too large)
    const summary = {
      grid_size: result.grid_size,
      mode: result.mode,
      iterations: result.iterations,
      final_residual: result.final_residual,
      elapsed_seconds: result.elapsed_seconds,
      result_path: resultPath,
      heatmap_path: heatmapPath,
    };

    return JSON.stringify(summary);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return JSON.stringify({ error: `Solver failed: ${msg}` });
  }
}

function executeEvaluateDesign(args: Record<string, unknown>): string {
  const resultPath = args.result_path as string;
  const targetMaxTemp = args.target_max_temp as number | undefined;

  if (!resultPath || !existsSync(resultPath)) {
    return JSON.stringify({ error: "Result file not found" });
  }

  try {
    let cmd = `cd "${REPO_ROOT}" && python tools/evaluate_design.py --result "${resultPath}"`;
    if (targetMaxTemp !== undefined) {
      cmd += ` --target-max-temp ${targetMaxTemp}`;
    }
    cmd += " 2>&1";

    const output = execSync(cmd, { timeout: 30000, encoding: "utf-8" });
    return output.trim();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return JSON.stringify({ error: `Evaluation failed: ${msg}` });
  }
}

function executeTool(
  name: string,
  args: Record<string, unknown>
): string {
  switch (name) {
    case "solve_thermal":
      return executeSolveThermal(args);
    case "evaluate_design":
      return executeEvaluateDesign(args);
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const userMessages = body.messages || [];

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...userMessages.map(
      (m: { role: string; content: string | unknown[] }) => ({
        role: m.role as "user" | "assistant",
        content:
          typeof m.content === "string"
            ? m.content
            : Array.isArray(m.content)
              ? m.content
                  .filter(
                    (c: unknown) =>
                      typeof c === "object" &&
                      c !== null &&
                      "type" in c &&
                      (c as { type: string }).type === "text"
                  )
                  .map((c: unknown) => (c as { text: string }).text)
                  .join("\n")
              : String(m.content),
      })
    ),
  ];

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
        );
      };

      let continueLoop = true;
      const MAX_TOOL_ROUNDS = 8;
      let round = 0;

      while (continueLoop && round < MAX_TOOL_ROUNDS) {
        round++;
        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages,
          tools,
          tool_choice: "auto",
        });

        const choice = response.choices[0];
        const message = choice.message;

        if (message.content) {
          send({ type: "text", text: message.content });
        }

        if (message.tool_calls && message.tool_calls.length > 0) {
          messages.push({
            role: "assistant",
            content: message.content,
            tool_calls: message.tool_calls,
          });

          for (const toolCall of message.tool_calls) {
            if (toolCall.type !== "function") continue;
            const fnName = toolCall.function.name;
            const fnArgs = JSON.parse(toolCall.function.arguments);

            send({
              type: "tool_call",
              tool_call_id: toolCall.id,
              tool_name: fnName,
              args: fnArgs,
            });

            const result = executeTool(fnName, fnArgs);

            send({
              type: "tool_result",
              tool_call_id: toolCall.id,
              tool_name: fnName,
              result: JSON.parse(result),
            });

            messages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: result,
            });
          }
        } else {
          continueLoop = false;
        }
      }

      send({ type: "done" });
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
