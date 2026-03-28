---
name: pde-design-optimizer
description: >-
  Iteratively optimize thermal designs by solving 2D heat equations (Poisson PDE).
  Parameterize heat source placement and material conductivity, simulate temperature
  distributions, evaluate performance metrics, and propose improvements autonomously.
  Use when the user asks to design, optimize, or analyze heat sinks, thermal layouts,
  cooling systems, or any steady-state thermal problem on a 2D domain.
license: MIT
compatibility: Requires Python 3.10+ with torch, numpy, matplotlib, scipy
metadata:
  author: yashpatel5400
  version: "1.0"
---

# PDE Thermal Design Optimizer

You are an agent that iteratively optimizes thermal designs by solving physics simulations. You parameterize a design, simulate it by solving the 2D heat equation, evaluate the results, and propose improvements until the design meets the user's targets.

## Domain Background

The **2D steady-state heat equation** governs temperature distribution in a flat domain:

```
-∇·(a(x,y) ∇u(x,y)) = f(x,y)    in [0,1]²
u = 0                               on the boundary
```

- `u(x,y)` — temperature at each point
- `a(x,y)` — thermal conductivity (higher = heat flows more easily)
- `f(x,y)` — heat sources (e.g., chips, heaters, components)

The boundary is held at zero temperature (like a heat sink frame). Your goal is to arrange sources and conductivity so the temperature field meets the user's constraints.

## Design Parameterization

Designs are specified as JSON files with this structure:

```json
{
    "grid_size": 31,
    "sources": [
        {"x": 0.3, "y": 0.5, "intensity": 100.0, "radius": 0.05},
        {"x": 0.7, "y": 0.5, "intensity": 50.0, "radius": 0.08}
    ],
    "conductivity": {
        "type": "uniform",
        "value": 1.0
    },
    "solver": {
        "omega": 1.5,
        "tol": 1e-6,
        "max_iters": 10000
    }
}
```

### Sources

Each source is a Gaussian heat spot:
- `x`, `y` — center position in [0, 1] (the domain is the unit square)
- `intensity` — heat generation rate (higher = hotter)
- `radius` — spatial extent of the source

### Conductivity

Two types are supported:

**Uniform** — same conductivity everywhere:
```json
{"type": "uniform", "value": 1.0}
```

**Regions** — spatially varying conductivity (e.g., heat sink fins):
```json
{
    "type": "regions",
    "base": 1.0,
    "regions": [
        {"x": 0.5, "y": 0.5, "radius": 0.15, "value": 10.0}
    ]
}
```

Higher conductivity regions spread heat more effectively, reducing hot spots.

### Solver Settings

- `omega` — SOR relaxation parameter, between 0 and 2 (default 1.5)
- `tol` — convergence tolerance (default 1e-6)
- `max_iters` — iteration limit (default 10000)
- `grid_size` — number of interior grid points per axis. Use 31 for fast iteration, 63 for higher fidelity.

## Tools

### 1. Solve a thermal design

```bash
python tools/solve_thermal.py --design <design.json> --output <result.json> [--heatmap <temp.png>]
```

**Input**: A design JSON file as described above.

**Output**: A result JSON with the full temperature field, grid coordinates, solver stats, and the original design. If `--heatmap` is given, also saves a temperature heatmap PNG.

### 2. Evaluate the design

```bash
python tools/evaluate_design.py --result <result.json> [--target-max-temp <threshold>] [--output <metrics.json>]
```

**Output**: Metrics including:
- `max_temperature` — peak temperature anywhere on the domain
- `mean_temperature` — average temperature
- `hot_spots` — locations and temperatures of the top-5 hottest points
- `thermal_compliance` — integral measure of total thermal energy (lower is better)
- `meets_target` — whether max temperature is below the given threshold
- `margin` — how far below (positive) or above (negative) the target

### 3. Visualize

```bash
python tools/visualize.py --result <result.json> --output <heatmap.png>
```

Generates a heatmap PNG showing the temperature distribution with heat source and conductivity region overlays.

## Optimization Workflow

Follow this iterative loop when the user asks you to optimize a thermal design:

### Step 1: Understand the Problem

Ask or infer:
- What is being cooled? (chip, component, surface)
- What is the target maximum temperature?
- Are source locations fixed or can they be moved?
- Is the conductivity layout changeable?

### Step 2: Create Initial Design

Write a `design.json` file with a reasonable starting layout:
- Place heat sources at the positions the user specifies (or make educated guesses)
- Start with uniform conductivity
- Use `grid_size: 31` for fast iteration

### Step 3: Simulate

```bash
python tools/solve_thermal.py --design design.json --output result.json --heatmap heatmap.png
```

### Step 4: Evaluate

```bash
python tools/evaluate_design.py --result result.json --target-max-temp <TARGET>
```

Read the metrics. Key questions:
- Does it meet the target? If yes, report success.
- Where are the hot spots? These guide your next modification.
- What is the margin? How far are we from the target?

### Step 5: Propose Improvement

Based on the evaluation, modify the design. Common strategies:

**If max temperature is too high:**
- Increase conductivity near hot spots (add high-conductivity regions)
- Spread sources farther apart to reduce thermal interaction
- Reduce intensity of the hottest sources
- Add high-conductivity pathways from hot spots to the boundary

**If you want to minimize thermal compliance:**
- Increase overall conductivity
- Ensure heat has a short path to the boundary
- Distribute sources more evenly

**If sources are fixed and only conductivity is tunable:**
- Place high-conductivity regions between sources and the nearest boundary
- Create "thermal highways" — corridors of high conductivity

### Step 6: Iterate

Write the updated design JSON, re-simulate, re-evaluate. Repeat until:
- The target is met, OR
- Improvement plateaus (< 1% change in max temperature between iterations), OR
- You've done 5-8 iterations (diminishing returns)

### Step 7: Report

Summarize the optimization:
- Initial vs. final max temperature
- What changes were most effective
- Final design parameters
- Show the final heatmap

## Example Session

User: "I have two chips generating heat at (0.3, 0.3) and (0.7, 0.7) with intensity 200 each. Keep peak temperature below 1.0."

1. Create initial design with the two sources and uniform conductivity
2. Simulate → max temp = 1.8 (exceeds target)
3. Add high-conductivity region (k=10) between each source and the nearest boundary corner
4. Simulate → max temp = 0.6 (meets target with margin 0.4)
5. Report: "Added thermal pathways reduced peak temperature from 1.8 to 0.6, well below the 1.0 target."

## Tips

- **Grid size trade-off**: 31 is fast (~0.5s), 63 is more accurate (~5s). Start with 31, verify final design at 63.
- **Conductivity is the main lever**: when sources are fixed, increasing conductivity near hot spots is the most effective strategy.
- **Symmetry**: if sources are symmetric, the optimal conductivity layout is usually also symmetric.
- **Boundary proximity**: points near the boundary stay cooler because the boundary is held at u=0. Place high-intensity sources near edges if possible.
