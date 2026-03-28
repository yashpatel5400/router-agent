"""
Successive Over-Relaxation (SOR) solver for the 2D Poisson system.

Provides two implementations:
- SORSolver: loop-based, correct for any omega in (0,2), slow on large grids
- SORSolverFast: red-black ordering with vectorized half-sweeps, much faster
"""

import torch


class SORSolver:
    """Loop-based SOR — simple and correct, but slow for large grids."""

    def __init__(self, omega=1.5):
        if not (0 < omega < 2):
            raise ValueError(f"omega must be in (0, 2), got {omega}")
        self.omega = omega

    def solve(self, pde, tol=1e-6, max_iters=5000):
        N = pde.N
        h2 = pde.h ** 2
        a = pde.a_field
        f = pde.f_field
        device = pde.device

        u = torch.zeros(N, N, device=device)
        b_norm = torch.linalg.norm(pde.b).item()
        if b_norm == 0:
            b_norm = 1.0

        history = []

        for k in range(max_iters):
            for i in range(N):
                for j in range(N):
                    a_c = a[i, j].item()
                    diag = 0.0
                    sigma = 0.0

                    for di, dj in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                        ni, nj = i + di, j + dj
                        if 0 <= ni < N and 0 <= nj < N:
                            a_half = 0.5 * (a_c + a[ni, nj].item())
                            diag += a_half / h2
                            sigma += (a_half / h2) * u[ni, nj].item()
                        else:
                            diag += a_c / h2

                    new_val = (f[i, j].item() + sigma) / diag
                    u[i, j] = (1 - self.omega) * u[i, j] + self.omega * new_val

            if (k + 1) % 10 == 0 or k == 0:
                res_norm = torch.linalg.norm(pde.compute_residual(u.reshape(-1))).item()
                rel_res = res_norm / b_norm
                history.append({"iter": k + 1, "residual_norm": res_norm, "relative_residual": rel_res})
                if rel_res < tol:
                    break

        return u, history


class SORSolverFast:
    """
    Red-black SOR with vectorized half-sweeps.

    Red-black ordering partitions the grid into two sets (like a checkerboard).
    Each color can be updated simultaneously since neighbors are all the other color.
    This gives true SOR convergence with vectorized operations.
    """

    def __init__(self, omega=1.5):
        if not (0 < omega < 2):
            raise ValueError(f"omega must be in (0, 2), got {omega}")
        self.omega = omega

    def solve(self, pde, tol=1e-6, max_iters=5000):
        N = pde.N
        h2 = pde.h ** 2
        a = pde.a_field
        f = pde.f_field
        device = pde.device

        # Pad with zeros for Dirichlet BCs
        u_pad = torch.zeros(N + 2, N + 2, device=device)

        # Replicate-pad conductivity so boundary half-conductivities are correct
        a_pad = torch.zeros(N + 2, N + 2, device=device)
        a_pad[1:-1, 1:-1] = a
        a_pad[0, 1:-1] = a[0, :]
        a_pad[-1, 1:-1] = a[-1, :]
        a_pad[1:-1, 0] = a[:, 0]
        a_pad[1:-1, -1] = a[:, -1]
        a_pad[0, 0] = a[0, 0]
        a_pad[0, -1] = a[0, -1]
        a_pad[-1, 0] = a[-1, 0]
        a_pad[-1, -1] = a[-1, -1]

        # Build red-black masks over the interior (N x N)
        ii, jj = torch.meshgrid(torch.arange(N, device=device),
                                torch.arange(N, device=device), indexing="ij")
        red_mask = ((ii + jj) % 2 == 0)
        black_mask = ~red_mask

        # Precompute half-conductivities (constant since a doesn't change)
        a_inner = a_pad[1:-1, 1:-1]
        a_left  = 0.5 * (a_inner + a_pad[1:-1, :-2])
        a_right = 0.5 * (a_inner + a_pad[1:-1, 2:])
        a_up    = 0.5 * (a_inner + a_pad[:-2, 1:-1])
        a_down  = 0.5 * (a_inner + a_pad[2:, 1:-1])
        diag = (a_left + a_right + a_up + a_down) / h2

        b_norm = torch.linalg.norm(f).item()
        if b_norm == 0:
            b_norm = 1.0

        history = []
        omega = self.omega

        for k in range(max_iters):
            # --- Red sweep: update red points using current (old) black neighbors ---
            neighbor_sum = (
                a_left  * u_pad[1:-1, :-2] +
                a_right * u_pad[1:-1, 2:] +
                a_up    * u_pad[:-2, 1:-1] +
                a_down  * u_pad[2:, 1:-1]
            ) / h2
            gs_val = (f + neighbor_sum) / diag
            u_inner = u_pad[1:-1, 1:-1]
            u_pad[1:-1, 1:-1] = torch.where(
                red_mask, (1 - omega) * u_inner + omega * gs_val, u_inner
            )

            # --- Black sweep: update black points using new red neighbors ---
            neighbor_sum = (
                a_left  * u_pad[1:-1, :-2] +
                a_right * u_pad[1:-1, 2:] +
                a_up    * u_pad[:-2, 1:-1] +
                a_down  * u_pad[2:, 1:-1]
            ) / h2
            gs_val = (f + neighbor_sum) / diag
            u_inner = u_pad[1:-1, 1:-1]
            u_pad[1:-1, 1:-1] = torch.where(
                black_mask, (1 - omega) * u_inner + omega * gs_val, u_inner
            )

            if (k + 1) % 10 == 0 or k == 0:
                res = pde.compute_residual(u_pad[1:-1, 1:-1].reshape(-1))
                res_norm = torch.linalg.norm(res).item()
                rel_res = res_norm / b_norm
                history.append({"iter": k + 1, "residual_norm": res_norm, "relative_residual": rel_res})
                if rel_res < tol:
                    break

        return u_pad[1:-1, 1:-1].clone(), history
