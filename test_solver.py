"""Quick smoke test: generate a random 2D Poisson problem, solve it, report error."""

import torch
from solver import PoissonEquation2D, SORSolverFast as SORSolver, GaussianRandomField


def main():
    N = 15  # 15x15 interior grid (small for a fast test)
    device = "cpu"

    # Generate a random forcing field
    grf = GaussianRandomField(N, alpha=2.0, tau=3.0, device=device)
    f_field = grf.sample(1).squeeze(0)  # (N, N)

    # Uniform conductivity
    a_field = torch.ones(N, N, device=device)

    # Build the PDE
    pde = PoissonEquation2D(a_field, f_field, N, device=device)

    # Direct solve (ground truth)
    u_exact = pde.solve_direct()

    # SOR solve
    solver = SORSolver(omega=1.5)
    u_sor, history = solver.solve(pde, tol=1e-8, max_iters=10000)

    # Compute error
    error = torch.linalg.norm(u_sor - u_exact) / torch.linalg.norm(u_exact)

    print(f"Grid: {N}x{N}  ({N*N} unknowns)")
    print(f"SOR iterations: {len(history)}")
    print(f"Final residual: {history[-1]['residual_norm']:.2e}")
    print(f"Relative error vs direct solve: {error:.2e}")
    print("PASS" if error < 1e-4 else "FAIL")


if __name__ == "__main__":
    main()
