#!/usr/bin/env python3
"""
CLI tool: solve a thermal design problem.

Takes a JSON design spec and outputs the temperature field + optional heatmap.

Usage:
    python tools/solve_thermal.py --design design.json --output result.json [--heatmap temp.png]

Design spec format:
{
    "grid_size": 64,
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

Conductivity can also be specified as regions:
{
    "type": "regions",
    "base": 1.0,
    "regions": [
        {"x": 0.5, "y": 0.5, "radius": 0.2, "value": 10.0}
    ]
}
"""

import argparse
import json
import sys
import os
import time

import torch
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from solver import PoissonEquation2D, SORSolverFast as SORSolver


def build_forcing_field(sources, N, device="cpu"):
    """Convert a list of heat source specs into an (N, N) forcing tensor."""
    f = torch.zeros(N, N, device=device)
    h = 1.0 / (N + 1)

    for src in sources:
        cx, cy = src["x"], src["y"]
        intensity = src.get("intensity", 1.0)
        radius = src.get("radius", 0.05)

        for i in range(N):
            for j in range(N):
                xi = (i + 1) * h
                yj = (j + 1) * h
                dist = np.sqrt((xi - cx) ** 2 + (yj - cy) ** 2)
                if dist <= radius:
                    f[i, j] += intensity * np.exp(-0.5 * (dist / (radius / 2)) ** 2)

    return f


def build_conductivity_field(cond_spec, N, device="cpu"):
    """Convert conductivity spec into an (N, N) tensor."""
    if cond_spec is None:
        return torch.ones(N, N, device=device)

    ctype = cond_spec.get("type", "uniform")

    if ctype == "uniform":
        val = cond_spec.get("value", 1.0)
        return torch.full((N, N), val, device=device)

    elif ctype == "regions":
        base = cond_spec.get("base", 1.0)
        a = torch.full((N, N), base, device=device)
        h = 1.0 / (N + 1)

        for region in cond_spec.get("regions", []):
            rx, ry = region["x"], region["y"]
            rr = region.get("radius", 0.1)
            rval = region["value"]
            for i in range(N):
                for j in range(N):
                    xi = (i + 1) * h
                    yj = (j + 1) * h
                    if np.sqrt((xi - rx) ** 2 + (yj - ry) ** 2) <= rr:
                        a[i, j] = rval
        return a

    else:
        raise ValueError(f"Unknown conductivity type: {ctype}")


def main():
    parser = argparse.ArgumentParser(description="Solve a 2D thermal design problem")
    parser.add_argument("--design", required=True, help="Path to design JSON file")
    parser.add_argument("--output", default="result.json", help="Output result JSON path")
    parser.add_argument("--heatmap", default=None, help="Optional: save heatmap PNG")
    parser.add_argument("--mode", default="classical", choices=["classical", "surrogate"],
                        help="Solver mode: classical (SOR) or surrogate (FNO)")
    args = parser.parse_args()

    with open(args.design) as f:
        design = json.load(f)

    N = design.get("grid_size", 64)
    device = "cpu"

    # Build fields
    sources = design.get("sources", [])
    f_field = build_forcing_field(sources, N, device)
    a_field = build_conductivity_field(design.get("conductivity"), N, device)

    # Solver config
    solver_cfg = design.get("solver", {})
    omega = solver_cfg.get("omega", 1.5)
    tol = solver_cfg.get("tol", 1e-6)
    max_iters = solver_cfg.get("max_iters", 10000)

    if args.mode == "surrogate":
        try:
            from solver.surrogate import FNOSurrogate, get_default_checkpoint_path
            ckpt_path = design.get("surrogate_checkpoint", get_default_checkpoint_path())
            surrogate = FNOSurrogate(N=N, device=device)
            surrogate.load_checkpoint(ckpt_path)
            t0 = time.time()
            u = surrogate.predict(a_field, f_field)
            elapsed = time.time() - t0
            history = [{"iter": 1, "residual_norm": 0.0, "relative_residual": 0.0}]
            print(f"Surrogate inference completed in {elapsed:.3f}s")
        except (ImportError, FileNotFoundError) as e:
            print(f"Surrogate not available ({e}), falling back to classical solver", file=sys.stderr)
            args.mode = "classical"

    if args.mode == "classical":
        pde = PoissonEquation2D(a_field, f_field, N, device=device)
        solver = SORSolver(omega=omega)

        t0 = time.time()
        u, history = solver.solve(pde, tol=tol, max_iters=max_iters)
        elapsed = time.time() - t0
        print(f"SOR converged in {len(history)} iterations ({elapsed:.2f}s)")

    # Build result
    h = 1.0 / (N + 1)
    coords_x = [(i + 1) * h for i in range(N)]
    coords_y = [(j + 1) * h for j in range(N)]

    result = {
        "grid_size": N,
        "mode": args.mode,
        "iterations": len(history),
        "final_residual": history[-1]["residual_norm"],
        "elapsed_seconds": round(elapsed, 4),
        "temperature_field": u.detach().cpu().numpy().tolist(),
        "coords_x": coords_x,
        "coords_y": coords_y,
        "design": design,
    }

    with open(args.output, "w") as f:
        json.dump(result, f, indent=2)
    print(f"Results written to {args.output}")

    if args.heatmap:
        from tools.visualize import save_heatmap
        sources = design.get("sources", [])
        cond_spec = design.get("conductivity", {})
        cond_regions = cond_spec.get("regions", []) if cond_spec.get("type") == "regions" else None
        save_heatmap(u.detach().cpu().numpy(), coords_x, coords_y, args.heatmap,
                     title="Temperature Distribution", sources=sources,
                     cond_regions=cond_regions)
        print(f"Heatmap saved to {args.heatmap}")


if __name__ == "__main__":
    main()
