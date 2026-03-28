import { streamText, tool, stepCountIs, convertToModelMessages } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { execSync } from "child_process";
import { writeFileSync, readFileSync, mkdirSync, existsSync } from "fs";
import { join, basename } from "path";

const REPO_ROOT = join(process.cwd(), "..");
const TMP_DIR = join(REPO_ROOT, "outputs");

function ensureTmpDir() {
  if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true });
}

const SYSTEM_PROMPT = `You are a thermal design optimization assistant. You help users design and optimize thermal layouts by solving 2D heat equations (Poisson PDE).

You have tools to:
1. **solve_thermal**: Solve a thermal design problem. Takes a design spec with heat sources and conductivity, runs the PDE solver, returns solver stats and a heatmap URL.
2. **evaluate_design**: Evaluate a solved design. Computes max/mean temperature, hot spots, thermal compliance, and checks against a target.
3. **visualize**: Generate a heatmap visualization from a solved result. Returns a heatmap image URL.

When the user describes a thermal problem:
1. Create a design with appropriate sources, conductivity, and grid settings
2. Solve it using solve_thermal (this also generates a heatmap)
3. Evaluate the result with evaluate_design
4. If the target isn't met, propose modifications and iterate
5. Explain your reasoning and the physics at each step
6. Use visualize to generate additional heatmaps when comparing designs

Keep responses concise. Focus on actionable insights from the simulation results.
The domain is [0,1]² with zero-temperature (Dirichlet) boundary conditions.
Source positions must be in (0,1). Intensity controls heat generation rate. Radius controls spatial extent.
Conductivity can be uniform or have high-conductivity regions to create thermal pathways.`;

export async function POST(req: Request) {
  const { messages: uiMessages } = await req.json();
  const modelMessages = await convertToModelMessages(uiMessages);

  const result = streamText({
    model: openai("gpt-4o"),
    system: SYSTEM_PROMPT,
    messages: modelMessages,
    stopWhen: stepCountIs(5),
    tools: {
      solve_thermal: tool({
        description:
          "Solve a 2D steady-state heat equation for a thermal design. Returns solver stats.",
        inputSchema: z.object({
          grid_size: z.number().default(31).describe("Grid points per axis"),
          sources: z
            .array(
              z.object({
                x: z.number().describe("x position in [0,1]"),
                y: z.number().describe("y position in [0,1]"),
                intensity: z.number().describe("Heat generation rate"),
                radius: z.number().describe("Spatial extent of the source"),
              })
            )
            .describe("List of heat sources"),
          conductivity_type: z
            .enum(["uniform", "regions"])
            .default("uniform")
            .describe("Conductivity type"),
          conductivity_value: z
            .number()
            .default(1.0)
            .describe("Uniform conductivity value"),
          conductivity_base: z
            .number()
            .default(1.0)
            .describe("Base conductivity for regions mode"),
          conductivity_regions: z
            .array(
              z.object({
                x: z.number(),
                y: z.number(),
                radius: z.number(),
                value: z.number(),
              })
            )
            .default([])
            .describe("High-conductivity regions"),
        }),
        execute: async (args) => {
          ensureTmpDir();
          const designId = `design_${Date.now()}`;
          const designPath = join(TMP_DIR, `${designId}.json`);
          const resultPath = join(TMP_DIR, `${designId}_result.json`);
          const heatmapPath = join(TMP_DIR, `${designId}_heatmap.png`);

          const design = {
            grid_size: args.grid_size,
            sources: args.sources,
            conductivity:
              args.conductivity_type === "regions"
                ? {
                    type: "regions",
                    base: args.conductivity_base,
                    regions: args.conductivity_regions,
                  }
                : { type: "uniform", value: args.conductivity_value },
            solver: { omega: 1.5, tol: 1e-6, max_iters: 10000 },
          };

          writeFileSync(designPath, JSON.stringify(design, null, 2));

          try {
            const cmd = `cd "${REPO_ROOT}" && python tools/solve_thermal.py --design "${designPath}" --output "${resultPath}" --heatmap "${heatmapPath}" 2>&1`;
            const output = execSync(cmd, {
              timeout: 120000,
              encoding: "utf-8",
            });

            const raw = readFileSync(resultPath, "utf-8");
            const parsed = JSON.parse(raw);

            return {
              grid_size: parsed.grid_size,
              iterations: parsed.iterations,
              final_residual: parsed.final_residual,
              elapsed_seconds: parsed.elapsed_seconds,
              result_path: resultPath,
              heatmap_url: `/api/images/${basename(heatmapPath)}`,
              solver_output: output.trim(),
            };
          } catch (e: unknown) {
            return {
              error: e instanceof Error ? e.message : String(e),
            };
          }
        },
      }),
      evaluate_design: tool({
        description:
          "Evaluate a solved thermal design. Returns temperature metrics and target check.",
        inputSchema: z.object({
          result_path: z
            .string()
            .describe("Path to the result JSON from solve_thermal"),
          target_max_temp: z
            .number()
            .optional()
            .describe("Target maximum temperature threshold"),
        }),
        execute: async (args) => {
          if (!args.result_path || !existsSync(args.result_path)) {
            return { error: "Result file not found" };
          }

          try {
            let cmd = `cd "${REPO_ROOT}" && python tools/evaluate_design.py --result "${args.result_path}"`;
            if (args.target_max_temp !== undefined) {
              cmd += ` --target-max-temp ${args.target_max_temp}`;
            }
            const output = execSync(cmd, {
              timeout: 30000,
              encoding: "utf-8",
            });
            return JSON.parse(output.trim());
          } catch (e: unknown) {
            return {
              error: e instanceof Error ? e.message : String(e),
            };
          }
        },
      }),
      visualize: tool({
        description:
          "Generate a heatmap visualization of a solved thermal design. Returns a URL to the heatmap image.",
        inputSchema: z.object({
          result_path: z
            .string()
            .describe("Path to the result JSON from solve_thermal"),
          title: z
            .string()
            .default("Temperature Distribution")
            .describe("Title for the heatmap"),
        }),
        execute: async (args) => {
          if (!args.result_path || !existsSync(args.result_path)) {
            return { error: "Result file not found" };
          }

          const heatmapName = `viz_${Date.now()}.png`;
          const heatmapPath = join(TMP_DIR, heatmapName);

          try {
            const cmd = `cd "${REPO_ROOT}" && python tools/visualize.py --result "${args.result_path}" --output "${heatmapPath}" --title "${args.title}" 2>&1`;
            execSync(cmd, { timeout: 30000, encoding: "utf-8" });
            return {
              heatmap_url: `/api/images/${heatmapName}`,
            };
          } catch (e: unknown) {
            return {
              error: e instanceof Error ? e.message : String(e),
            };
          }
        },
      }),
    },
  });

  return result.toUIMessageStreamResponse({
    originalMessages: uiMessages,
  });
}
