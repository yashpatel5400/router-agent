# PDE Design Optimization Agent

An Agent Skill that gives AI coding agents the ability to **iteratively optimize thermal designs** by solving 2D heat equations (Poisson PDE). The agent parameterizes a design, simulates it, evaluates performance, and proposes improvements — all autonomously.

## What This Does

This skill teaches an AI agent to run a physics-based design optimization loop:

1. **Parameterize** a thermal design (heat source placement, material conductivity)
2. **Simulate** by solving the 2D steady-state heat equation using a numerical PDE solver
3. **Evaluate** temperature distribution — max temperature, hot spots, thermal compliance
4. **Iterate** — propose design modifications and re-simulate until targets are met

## Quick Start

```bash
pip install -r requirements.txt

# Solve a thermal problem
python tools/solve_thermal.py --design examples/example_design.json --output output.json --heatmap temperature.png

# Evaluate the result
python tools/evaluate_design.py --result output.json
```

## Project Structure

```
solver/          # PDE solver core
  pde.py         # 2D Poisson equation (Dirichlet BCs)
  numerical_solver.py  # SOR iterative solver
  data_generation.py   # Gaussian random field sampling

tools/           # CLI tools the agent calls
  solve_thermal.py     # Solve a thermal design
  evaluate_design.py   # Compute design metrics
  visualize.py         # Generate heatmap visualizations

examples/        # Example designs and walkthroughs
SKILL.md         # Agent Skill definition
```

## The Physics

The 2D steady-state heat equation with variable conductivity:

```
-∇·(a(x,y) ∇u(x,y)) = f(x,y)    in D = [0,1]²
u(x,y) = 0                         on ∂D
```

where `a` is thermal conductivity, `u` is temperature, and `f` represents heat sources.
Discretized via finite differences and solved with Successive Over-Relaxation (SOR).
