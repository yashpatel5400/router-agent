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


BG_COLOR = "#0a0a0a"
TEXT_COLOR = "#a1a1aa"
ACCENT_COLOR = "#f97316"

def save_heatmap(u, coords_x, coords_y, output_path, title="Temperature Distribution",
                 sources=None, cond_regions=None):
    """
    Save a heatmap of the temperature field with dark theme styling.

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
    fig, ax = plt.subplots(1, 1, figsize=(7, 6))
    fig.patch.set_facecolor(BG_COLOR)
    ax.set_facecolor(BG_COLOR)

    extent = [coords_y[0], coords_y[-1], coords_x[0], coords_x[-1]]
    im = ax.imshow(u, origin="lower", extent=extent, cmap="inferno", aspect="equal")

    cbar = plt.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
    cbar.set_label("Temperature", fontsize=11, color=TEXT_COLOR)
    cbar.ax.yaxis.set_tick_params(color=TEXT_COLOR)
    cbar.outline.set_edgecolor("#27272a")
    plt.setp(cbar.ax.yaxis.get_ticklabels(), color=TEXT_COLOR, fontsize=9)

    if sources:
        for src in sources:
            ax.plot(src["y"], src["x"], "^", color="#22d3ee", markersize=9,
                    markeredgecolor="white", markeredgewidth=1.2)
            if "radius" in src:
                circle = Circle((src["y"], src["x"]), src["radius"],
                                fill=False, edgecolor="#22d3ee", linewidth=1.2,
                                linestyle="--", alpha=0.7)
                ax.add_patch(circle)

    if cond_regions:
        for reg in cond_regions:
            circle = Circle((reg["y"], reg["x"]), reg.get("radius", 0.1),
                            fill=False, edgecolor="#4ade80", linewidth=1.8, linestyle="-")
            ax.add_patch(circle)
            ax.annotate(f'k={reg["value"]:.0f}', (reg["y"], reg["x"]),
                        color="#4ade80", fontsize=8, ha="center", va="bottom",
                        fontweight="bold")

    ax.set_xlabel("y", fontsize=11, color=TEXT_COLOR)
    ax.set_ylabel("x", fontsize=11, color=TEXT_COLOR)
    ax.tick_params(colors=TEXT_COLOR, labelsize=9)
    for spine in ax.spines.values():
        spine.set_edgecolor("#27272a")
    ax.set_title(title, fontsize=13, fontweight="bold", color=TEXT_COLOR, pad=10)

    plt.tight_layout()
    plt.savefig(output_path, dpi=150, bbox_inches="tight", facecolor=BG_COLOR,
                edgecolor="none")
    plt.close(fig)


def save_convergence_plot(history, output_path, title="Solver Convergence"):
    """Save a convergence plot (residual norm vs iteration)."""
    iters = [h["iter"] for h in history]
    res = [h["residual_norm"] for h in history]

    fig, ax = plt.subplots(figsize=(7, 4))
    fig.patch.set_facecolor(BG_COLOR)
    ax.set_facecolor(BG_COLOR)
    ax.semilogy(iters, res, color=ACCENT_COLOR, linewidth=1.5)
    ax.set_xlabel("Iteration", fontsize=11, color=TEXT_COLOR)
    ax.set_ylabel("Residual Norm", fontsize=11, color=TEXT_COLOR)
    ax.set_title(title, fontsize=13, fontweight="bold", color=TEXT_COLOR, pad=10)
    ax.tick_params(colors=TEXT_COLOR, labelsize=9)
    ax.grid(True, alpha=0.15, color="#3f3f46")
    for spine in ax.spines.values():
        spine.set_edgecolor("#27272a")
    plt.tight_layout()
    plt.savefig(output_path, dpi=150, bbox_inches="tight", facecolor=BG_COLOR,
                edgecolor="none")
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
