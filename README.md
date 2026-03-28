# PDE Design Optimization Agent Skill

An [Agent Skill](https://agentskills.io/) that gives AI coding agents the ability to **iteratively optimize thermal designs** by solving 2D heat equations (Poisson PDE). The agent parameterizes a design, simulates it, evaluates performance, and proposes improvements — all autonomously.

## What This Does

This skill teaches an AI agent to run a physics-based design optimization loop:

1. **Parameterize** a thermal design (heat source placement, material conductivity)
2. **Simulate** by solving the 2D steady-state heat equation using a numerical PDE solver
3. **Evaluate** temperature distribution — max temperature, hot spots, thermal compliance
4. **Iterate** — propose design modifications and re-simulate until targets are met

## Quick Start

```bash
pip install -r requirements.txt

# Solve a thermal problem with two heat sources
python tools/solve_thermal.py --design examples/example_design.json --output result.json --heatmap heatmap.png

# Evaluate the result against a target max temperature
python tools/evaluate_design.py --result result.json --target-max-temp 1.0

# Visualize the temperature distribution
python tools/visualize.py --result result.json --output heatmap.png
```

## Example: Optimization in Action

Starting with two high-intensity heat sources and uniform conductivity, the agent identifies that peak temperature (1.14) exceeds the target (1.0). It then adds high-conductivity thermal pathways between the heat sources and the boundary, reducing peak temperature to 0.56 — a 50% reduction in one iteration.

See [examples/heat_sink_optimization.md](examples/heat_sink_optimization.md) for the full walkthrough.

## Project Structure

```
SKILL.md                     # Agent Skill definition (the core of this project)
solver/
  pde.py                     # 2D Poisson equation with Dirichlet BCs
  numerical_solver.py        # SOR iterative solver (loop + vectorized red-black)
  data_generation.py         # Gaussian random field generator
  surrogate.py               # Optional FNO neural operator for fast inference
tools/
  solve_thermal.py           # CLI: solve a design → temperature field + heatmap
  evaluate_design.py         # CLI: compute metrics from solved temperature field
  visualize.py               # CLI: generate heatmap visualizations
examples/
  example_design.json        # Sample design input
  example_design_optimized.json  # Optimized design with thermal pathways
  heat_sink_optimization.md  # Full optimization walkthrough
checkpoints/                 # Pre-trained FNO weights (optional)
```

## The Physics

The 2D steady-state heat equation with variable conductivity:

```
-∇·(a(x,y) ∇u(x,y)) = f(x,y)    in [0,1]²
u(x,y) = 0                         on ∂D (boundary)
```

| Symbol | Meaning |
|--------|---------|
| `u(x,y)` | Temperature at each point |
| `a(x,y)` | Thermal conductivity (higher → heat spreads more easily) |
| `f(x,y)` | Heat sources (chips, heaters, components) |

Discretized via finite differences on a uniform grid. Solved iteratively with Successive Over-Relaxation (SOR) using red-black ordering for vectorized performance, or optionally via a pre-trained Fourier Neural Operator (FNO) surrogate for near-instant inference.

## Using as an Agent Skill

Copy or symlink this directory into your agent's skills folder:

```bash
# For Cursor / Claude Code
cp -r . ~/.cursor/skills/pde-design-optimizer/

# Or install from GitHub
# (follow your agent's skill installation instructions)
```

The agent will read `SKILL.md` and learn to use the thermal design tools autonomously when asked to optimize heat layouts, design heat sinks, or solve thermal problems.

## License

MIT
