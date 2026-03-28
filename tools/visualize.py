#!/usr/bin/env python3
"""
Visualization utilities for thermal design problems.

Generates heatmap PNGs of temperature distributions and design overlays.

Usage:
    python tools/visualize.py --result result.json --output heatmap.png
"""

import argparse
import json
import sys
import os

import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Circle


def save_heatmap(u, coords_x, coords_y, output_path, title="Temperature Distribution",
                 sources=None, cond_regions=None):
    """
    Save a heatmap of the temperature field.

    Parameters
    ----------
    u : np.ndarray, shape (N, N)
        Temperature field.
    coords_x, coords_y : list of float
        Grid coordinates.
    output_path : str
        Where to save the PNG.
    title : str
        Plot title.
    sources : list of dict, optional
        Heat source specs to overlay as markers.
    cond_regions : list of dict, optional
        Conductivity regions to overlay as circles.
    """
    fig, ax = plt.subplots(1, 1, figsize=(8, 6))

    extent = [coords_y[0], coords_y[-1], coords_x[0], coords_x[-1]]
    im = ax.imshow(u, origin="lower", extent=extent, cmap="hot", aspect="equal")

    cbar = plt.colorbar(im, ax=ax)
    cbar.set_label("Temperature", fontsize=12)

    if sources:
        for src in sources:
            ax.plot(src["y"], src["x"], "c^", markersize=10, markeredgecolor="white",
                    markeredgewidth=1.5, label=f"Source ({src['intensity']:.0f})")
            if "radius" in src:
                circle = Circle((src["y"], src["x"]), src["radius"],
                                fill=False, edgecolor="cyan", linewidth=1.5, linestyle="--")
                ax.add_patch(circle)

    if cond_regions:
        for reg in cond_regions:
            circle = Circle((reg["y"], reg["x"]), reg.get("radius", 0.1),
                            fill=False, edgecolor="lime", linewidth=2, linestyle="-")
            ax.add_patch(circle)
            ax.annotate(f'k={reg["value"]}', (reg["y"], reg["x"]),
                        color="lime", fontsize=9, ha="center", va="bottom",
                        fontweight="bold")

    ax.set_xlabel("y", fontsize=12)
    ax.set_ylabel("x", fontsize=12)
    ax.set_title(title, fontsize=14, fontweight="bold")

    plt.tight_layout()
    plt.savefig(output_path, dpi=150, bbox_inches="tight")
    plt.close(fig)


def save_convergence_plot(history, output_path, title="Solver Convergence"):
    """Save a convergence plot (residual norm vs iteration)."""
    iters = [h["iter"] for h in history]
    res = [h["residual_norm"] for h in history]

    fig, ax = plt.subplots(figsize=(8, 5))
    ax.semilogy(iters, res, "b-", linewidth=1.5)
    ax.set_xlabel("Iteration", fontsize=12)
    ax.set_ylabel("Residual Norm", fontsize=12)
    ax.set_title(title, fontsize=14, fontweight="bold")
    ax.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.savefig(output_path, dpi=150, bbox_inches="tight")
    plt.close(fig)


def main():
    parser = argparse.ArgumentParser(description="Visualize thermal design results")
    parser.add_argument("--result", required=True, help="Path to result JSON")
    parser.add_argument("--output", default="heatmap.png", help="Output PNG path")
    parser.add_argument("--title", default="Temperature Distribution", help="Plot title")
    args = parser.parse_args()

    with open(args.result) as f:
        result = json.load(f)

    u = np.array(result["temperature_field"])
    coords_x = result["coords_x"]
    coords_y = result["coords_y"]

    design = result.get("design", {})
    sources = design.get("sources", [])
    cond_spec = design.get("conductivity", {})
    cond_regions = cond_spec.get("regions", []) if cond_spec.get("type") == "regions" else None

    save_heatmap(u, coords_x, coords_y, args.output, title=args.title,
                 sources=sources, cond_regions=cond_regions)
    print(f"Heatmap saved to {args.output}")


if __name__ == "__main__":
    main()
