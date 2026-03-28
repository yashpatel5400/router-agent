"""
Successive Over-Relaxation (SOR) solver for the 2D Poisson system A u = b.

SOR is a variant of Gauss-Seidel with a relaxation parameter omega ∈ (0, 2).
  omega = 1  -> Gauss-Seidel
  omega > 1  -> over-relaxation (faster convergence for many problems)
"""

import torch


class SORSolver:
    def __init__(self, omega=1.5):
        """
        Parameters
        ----------
        omega : float
            Relaxation factor. Must be in (0, 2) for convergence.
            Optimal omega depends on the problem; 1.5 is a reasonable default
            for the 2D Poisson equation on moderate grids.
        """
        if not (0 < omega < 2):
            raise ValueError(f"omega must be in (0, 2), got {omega}")
        self.omega = omega

    def solve(self, pde, tol=1e-6, max_iters=5000):
        """
        Solve A u = b using SOR iteration.

        Parameters
        ----------
        pde : PoissonEquation2D
            The assembled PDE system.
        tol : float
            Convergence tolerance on the relative residual norm.
        max_iters : int
            Maximum number of iterations.

        Returns
        -------
        u : torch.Tensor, shape (N, N)
            Solution field (temperature).
        history : list of dict
            Per-iteration convergence info: {"iter", "residual_norm"}.
        """
        A = pde.A
        b = pde.b
        n = b.shape[0]

        u = torch.zeros(n, device=pde.device)
        b_norm = torch.linalg.norm(b).item()
        if b_norm == 0:
            b_norm = 1.0

        history = []

        for k in range(max_iters):
            for i in range(n):
                sigma = A[i, :] @ u - A[i, i] * u[i]
                u[i] = (1 - self.omega) * u[i] + (self.omega / A[i, i]) * (b[i] - sigma)

            res_norm = torch.linalg.norm(pde.compute_residual(u)).item()
            rel_res = res_norm / b_norm
            history.append({"iter": k + 1, "residual_norm": res_norm, "relative_residual": rel_res})

            if rel_res < tol:
                break

        return u.reshape(pde.N, pde.N), history
