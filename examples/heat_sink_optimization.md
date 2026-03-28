# Example: Heat Sink Optimization

This walkthrough shows how an agent uses the PDE Design Optimizer skill to keep peak temperature below a target threshold by iterating on the thermal design.

## Problem Statement

Two chips generate heat at positions (0.3, 0.3) and (0.7, 0.7), each with intensity 500. The target is to keep peak temperature below 1.0 on the unit square domain with zero-temperature boundaries.

## Iteration 1: Uniform Conductivity Baseline

**Design** (`design_v1.json`):
```json
{
    "grid_size": 31,
    "sources": [
        {"x": 0.3, "y": 0.3, "intensity": 500.0, "radius": 0.06},
        {"x": 0.7, "y": 0.7, "intensity": 500.0, "radius": 0.06}
    ],
    "conductivity": {"type": "uniform", "value": 1.0},
    "solver": {"omega": 1.5, "tol": 1e-6, "max_iters": 10000}
}
```

**Solve:**
```bash
python tools/solve_thermal.py --design design_v1.json --output result_v1.json --heatmap heatmap_v1.png
```

**Evaluate:**
```bash
python tools/evaluate_design.py --result result_v1.json --target-max-temp 1.0
```

**Results:**
| Metric | Value |
|--------|-------|
| Max temperature | 1.14 |
| Mean temperature | 0.29 |
| Meets target? | No |
| Margin | -0.14 |

The peak temperature of 1.14 exceeds the 1.0 target. Hot spots are at the source locations (0.31, 0.31) and (0.69, 0.69).

**Analysis:** The hot spots are near the center of the domain, far from the cooling boundary. We need to create better thermal pathways to conduct heat toward the edges.

## Iteration 2: Add High-Conductivity Thermal Pathways

**Strategy:** Place high-conductivity regions (k=5) between each heat source and the nearest boundary corner. This creates "thermal highways" that help heat flow to the cold boundary faster.

**Design** (`design_v2.json`):
```json
{
    "grid_size": 31,
    "sources": [
        {"x": 0.3, "y": 0.3, "intensity": 500.0, "radius": 0.06},
        {"x": 0.7, "y": 0.7, "intensity": 500.0, "radius": 0.06}
    ],
    "conductivity": {
        "type": "regions",
        "base": 1.0,
        "regions": [
            {"x": 0.15, "y": 0.15, "radius": 0.2, "value": 5.0},
            {"x": 0.85, "y": 0.85, "radius": 0.2, "value": 5.0}
        ]
    },
    "solver": {"omega": 1.5, "tol": 1e-6, "max_iters": 10000}
}
```

**Results:**
| Metric | Value | Change |
|--------|-------|--------|
| Max temperature | 0.56 | -50% |
| Mean temperature | 0.13 | -56% |
| Meets target? | Yes | |
| Margin | +0.44 | |

Adding high-conductivity pathways reduced peak temperature from 1.14 to 0.56 — well below the 1.0 target with substantial margin.

## Summary

| Design | Max Temp | Meets Target | Key Change |
|--------|----------|--------------|------------|
| v1: Uniform k=1 | 1.14 | No | Baseline |
| v2: Thermal pathways k=5 | 0.56 | Yes | +5x conductivity near corners |

The optimization converged in just 2 iterations. The key insight was that **increasing conductivity between heat sources and the boundary** is the most effective lever for reducing peak temperature when source positions are fixed.

## Running This Example

```bash
# Step 1: Solve initial design
python tools/solve_thermal.py --design examples/example_design.json --output result.json --heatmap heatmap.png

# Step 2: Evaluate
python tools/evaluate_design.py --result result.json --target-max-temp 1.0

# Step 3: Iterate (modify design JSON based on evaluation, re-run)
```
