import { streamText, tool, stepCountIs, convertToModelMessages } from "ai";
import { openai } from "@ai-sdk/openai";
import { Ratelimit } from "@unkey/ratelimit";
import { z } from "zod";
import { execSync } from "child_process";
import { writeFileSync, readFileSync, mkdirSync, existsSync, readdirSync, statSync } from "fs";
import { join } from "path";

const ratelimit = process.env.UNKEY_ROOT_KEY
  ? new Ratelimit({
      rootKey: process.env.UNKEY_ROOT_KEY,
      namespace: "pde-optimizer",
      limit: 20,
      duration: "60s",
    })
  : null;

const REPO_ROOT = join(process.cwd(), "..");
const TMP_DIR = join(REPO_ROOT, "outputs");

function ensureTmpDir() {
  if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true });
}

function findLatestResultFile(): string | null {
  if (!existsSync(TMP_DIR)) return null;
  const files = readdirSync(TMP_DIR)
    .filter((f) => f.endsWith("_result.json"))
    .map((f) => ({ name: f, mtime: statSync(join(TMP_DIR, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  return files.length > 0 ? join(TMP_DIR, files[0].name) : null;
}

function resolveResultPath(providedPath: string | undefined): string | null {
  if (providedPath && existsSync(providedPath)) return providedPath;
  return findLatestResultFile();
}

const SYSTEM_PROMPT = `You are a thermal design optimization assistant. You help users design and optimize thermal layouts by solving 2D heat equations (Poisson PDE).

You have tools to:
1. **solve_thermal**: Solve a thermal design problem. Takes a design spec with heat sources and conductivity, runs the PDE solver, returns solver stats and a heatmap image that is displayed inline.
2. **evaluate_design**: Evaluate a solved design. Computes max/mean temperature, hot spots, thermal compliance, and checks against a target.
3. **visualize**: Generate a heatmap visualization from a solved result. Returns a heatmap image displayed inline.

CRITICAL WORKFLOW — you MUST follow this multi-step iterative process:

**Step 1: Baseline solve (COARSE grid, uniform conductivity)**
- Acknowledge the problem in 1-2 sentences
- Call solve_thermal with: grid_size=32, omega=1.5, tol=1e-4, uniform conductivity (value 1.0)
- Briefly note: "Starting with a coarse 32x32 grid and loose tolerance for fast baseline"
- Call evaluate_design to quantify how far the baseline is from the target
- Report the gap: "Baseline peak temp is X, target is Y — we need to reduce by Z"

**Step 2: First optimization (still coarse grid)**
- Analyze hotspots from the baseline heatmap
- Add initial heat spreaders (conductivity 10-20, radius 0.1-0.15)
- Call solve_thermal with: grid_size=32, omega=1.5, tol=1e-4 (same coarse settings — we're still exploring)
- Call evaluate_design

**Step 3: Refine grid + tune omega**
- MANDATORY: Increase grid_size to 64 and adjust omega to 1.7 for faster convergence on the larger grid
- Briefly explain: "Switching to 64x64 for better accuracy now that we have a promising design direction"
- Escalate spreaders (conductivity 30-50, wider radii 0.15-0.25)
- Call solve_thermal with: grid_size=64, omega=1.7, tol=1e-4
- Call evaluate_design

**Step 4: Aggressive design + tighter tolerance**
- MANDATORY: Tighten tol to 1e-6 for production-quality results
- Try omega=1.8 for faster convergence
- Add MORE spreader regions (6-8 total), create full thermal pathways
- Call solve_thermal with: grid_size=64, omega=1.8, tol=1e-6, max_iters=15000
- Call evaluate_design

**Step 5: Final push (if target not yet met)**
- Go extreme on both design AND solver: conductivity 80-100, large overlapping spreaders
- MANDATORY: Try grid_size=96 or 128 with omega=1.85, tol=1e-6, max_iters=20000
- Explain the resolution increase: "Running a high-fidelity solve to verify results"
- Call solve_thermal and evaluate_design

IMPORTANT: You MUST change at least one solver parameter (grid_size, omega, tol, or max_iters) between steps 2→3, 3→4, and 4→5. The user can see your parameter choices in a sidebar panel. Keeping the same parameters every time looks lazy. Show intelligent adaptation.

**FINAL STEP (MANDATORY): Conclusion message**
After your last evaluate_design call, you MUST write a concluding text message. Do NOT end on a tool call.
- If target was MET: Write a success summary with a ✅ header. Include: final peak temp vs target, how many iterations it took, what the winning strategy was (which spreaders, what conductivity values), and the percentage improvement from baseline.
- If target was NOT met after all iterations: Write a summary with the best result achieved, percentage reduction from baseline, explain the physical limits, and suggest what might help.

This final message is critical — the user needs closure on the optimization task.

KEY PRINCIPLES:
- ALWAYS start with a baseline (no spreaders) so the user can see the before/after improvement
- Each iteration should be MORE aggressive than the last — escalate, don't plateau
- Explain your reasoning briefly between iterations: why did the last attempt fall short? What physical insight drives the next modification?
- Start with conductivity values of 10-20 and escalate up to 100 if needed
- Use large spreader radii (0.1-0.3) — small ones are ineffective
- Place spreaders to create thermal pathways connecting hot spots to the cooler boundaries
- Add spreaders between interacting sources to prevent thermal coupling
- NEVER describe what a heatmap looks like in text — the user can see the actual heatmap inline
- NEVER end your response on a tool call — always finish with a text message
- NEVER give up before trying at least 5 design iterations

SOLVER PARAMETER REFERENCE:
- **grid_size**: 32 (fast, ~0.2s) → 64 (accurate, ~1s) → 128 (high-fidelity, ~5s)
- **omega**: 1.5 (safe default) → 1.7 (good for 64x64) → 1.8-1.85 (aggressive, faster convergence on large grids)
- **tol**: 1e-4 (exploratory) → 1e-6 (production) → 1e-8 (verification)
- **max_iters**: 5000 (small grids) → 10000-15000 (64x64) → 20000+ (128x128)

You MUST mention your parameter choices when they change. Say things like:
- "Switching to a 64x64 grid for better spatial resolution"
- "Increasing omega to 1.8 to speed up convergence on this larger grid"
- "Tightening tolerance to 1e-6 now that we have a promising design"

The domain is [0,1]² with zero-temperature (Dirichlet) boundary conditions.
Source positions must be in (0,1). Intensity controls heat generation rate. Radius controls spatial extent.
Conductivity can be uniform or have high-conductivity regions (heat spreaders / heat sinks) to create thermal pathways that draw heat toward the cool boundaries.`;

export async function POST(req: Request) {
  if (ratelimit) {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
    const { success, remaining, reset } = await ratelimit.limit(ip);
    if (!success) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "X-RateLimit-Remaining": remaining.toString(),
            "X-RateLimit-Reset": reset.toString(),
          },
        },
      );
    }
  }

  const { messages: uiMessages } = await req.json();
  const modelMessages = await convertToModelMessages(uiMessages);

  const result = streamText({
    model: openai("gpt-4o"),
    system: SYSTEM_PROMPT,
    messages: modelMessages,
    stopWhen: stepCountIs(16),
    tools: {
      solve_thermal: tool({
        description:
          "Solve a 2D steady-state heat equation for a thermal design. Returns solver stats.",
        inputSchema: z.object({
          grid_size: z.number().default(64).describe("Grid points per axis"),
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
          omega: z
            .number()
            .default(1.5)
            .describe(
              "SOR relaxation parameter in (0, 2). Higher values accelerate convergence but can diverge. Optimal for Poisson is typically 1.5-1.85 depending on grid size."
            ),
          tol: z
            .number()
            .default(1e-6)
            .describe(
              "Convergence tolerance for the relative residual. Use 1e-4 for fast exploratory solves, 1e-6 for production, 1e-8 for high-accuracy verification."
            ),
          max_iters: z
            .number()
            .default(10000)
            .describe(
              "Maximum SOR iterations before stopping. Increase for large grids or tight tolerances. 5000-10000 is typical for 64x64."
            ),
        }),
        execute: async (args) => {
          ensureTmpDir();
          const designId = `design_${Date.now()}`;
          const designPath = join(TMP_DIR, `${designId}.json`);
          const resultPath = join(TMP_DIR, `${designId}_result.json`);

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
            solver: { omega: args.omega, tol: args.tol, max_iters: args.max_iters },
          };

          writeFileSync(designPath, JSON.stringify(design, null, 2));

          try {
            const cmd = `cd "${REPO_ROOT}" && python tools/solve_thermal.py --design "${designPath}" --output "${resultPath}" 2>&1`;
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
              solver_output: output.trim(),
              solver_params: {
                omega: args.omega,
                tol: args.tol,
                max_iters: args.max_iters,
                grid_size: args.grid_size,
              },
              temperature_field: parsed.temperature_field,
              sources: args.sources,
              conductivity_regions:
                args.conductivity_type === "regions"
                  ? args.conductivity_regions
                  : [],
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
          const resolvedPath = resolveResultPath(args.result_path);
          if (!resolvedPath) {
            return { error: "No result file found. Run solve_thermal first." };
          }

          try {
            let cmd = `cd "${REPO_ROOT}" && python tools/evaluate_design.py --result "${resolvedPath}"`;
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
          const resolvedPath = resolveResultPath(args.result_path);
          if (!resolvedPath) {
            return { error: "No result file found. Run solve_thermal first." };
          }

          const heatmapName = `viz_${Date.now()}.png`;
          const heatmapPath = join(TMP_DIR, heatmapName);

          try {
            const cmd = `cd "${REPO_ROOT}" && python tools/visualize.py --result "${resolvedPath}" --output "${heatmapPath}" --title "${args.title}" 2>&1`;
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
