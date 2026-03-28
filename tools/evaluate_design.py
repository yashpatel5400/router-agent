#!/usr/bin/env python3
"""
CLI tool: evaluate a thermal design from its solved temperature field.

Computes metrics:
  - max_temperature: peak temperature anywhere
  - mean_temperature: average temperature over the domain
  - hot_spots: list of (x, y, temp) for the top-N hottest points
  - thermal_compliance: integral of u*f (total thermal energy, lower = better)
  - meets_target: whether max temp is below a given threshold

Usage:
    python tools/evaluate_design.py --result result.json [--target-max-temp 80]
"""

import argparse
import json
import sys
import os

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


def evaluate(result, target_max_temp=None, n_hotspots=5):
    """
    Evaluate a solved thermal design.

    Parameters
    ----------
    result : dict
        Output from solve_thermal.py with keys: temperature_field, coords_x, coords_y, design.
    target_max_temp : float or None
        If set, check whether peak temperature is below this threshold.
    n_hotspots : int
        Number of hottest points to report.

    Returns
    -------
    metrics : dict
    """
    u = np.array(result["temperature_field"])
    coords_x = result["coords_x"]
    coords_y = result["coords_y"]
    N = u.shape[0]

    max_temp = float(u.max())
    min_temp = float(u.min())
    mean_temp = float(u.mean())

    # Find hotspot locations
    flat_indices = np.argsort(u.ravel())[::-1][:n_hotspots]
    hot_spots = []
    for idx in flat_indices:
        i, j = divmod(int(idx), N)
        hot_spots.append({
            "x": round(coords_x[i], 4),
            "y": round(coords_y[j], 4),
            "temperature": round(float(u[i, j]), 4),
        })

    # Thermal compliance: sum(u * f) * h^2
    # Approximate from the design sources if available
    design = result.get("design", {})
    sources = design.get("sources", [])
    h = 1.0 / (N + 1)
    compliance = float(np.sum(u ** 2) * h * h)

    metrics = {
        "max_temperature": round(max_temp, 4),
        "min_temperature": round(min_temp, 4),
        "mean_temperature": round(mean_temp, 4),
        "thermal_compliance": round(compliance, 6),
        "hot_spots": hot_spots,
        "grid_size": N,
        "solver_iterations": result.get("iterations", None),
        "solver_time_seconds": result.get("elapsed_seconds", None),
    }

    if target_max_temp is not None:
        metrics["target_max_temp"] = target_max_temp
        metrics["meets_target"] = max_temp < target_max_temp
        metrics["margin"] = round(target_max_temp - max_temp, 4)

    return metrics


def main():
    parser = argparse.ArgumentParser(description="Evaluate a thermal design solution")
    parser.add_argument("--result", required=True, help="Path to result JSON from solve_thermal.py")
    parser.add_argument("--target-max-temp", type=float, default=None,
                        help="Target maximum temperature threshold")
    parser.add_argument("--n-hotspots", type=int, default=5, help="Number of hotspots to report")
    parser.add_argument("--output", default=None, help="Optional: save metrics to JSON file")
    args = parser.parse_args()

    with open(args.result) as f:
        result = json.load(f)

    metrics = evaluate(result, target_max_temp=args.target_max_temp, n_hotspots=args.n_hotspots)

    print(json.dumps(metrics, indent=2))

    if args.output:
        with open(args.output, "w") as f:
            json.dump(metrics, f, indent=2)
        print(f"\nMetrics saved to {args.output}")


if __name__ == "__main__":
    main()
