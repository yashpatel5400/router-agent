"""
2D Poisson equation discretization for steady-state heat conduction.

Solves:  -∇·(a(x,y) ∇u(x,y)) = f(x,y)  on [0,1]²
with Dirichlet BCs: u = 0 on the boundary.

a = thermal conductivity, u = temperature, f = heat sources.
"""

import torch


class PoissonEquation2D:
    def __init__(self, a_field, f_field, N, device="cpu"):
        """
        Parameters
        ----------
        a_field : torch.Tensor, shape (N, N)
            Conductivity at each grid point. Use torch.ones(N,N) for uniform.
        f_field : torch.Tensor, shape (N, N)
            Forcing / heat source at each grid point.
        N : int
            Number of interior grid points per axis (total grid is N×N).
        device : str
            Torch device.
        """
        self.N = N
        self.device = device
        self.h = 1.0 / (N + 1)

        self.a_field = a_field.to(device)
        self.f_field = f_field.to(device)

        self.A = self._build_matrix()
        self.b = self._build_rhs()

    def _idx(self, i, j):
        return i * self.N + j

    def _build_matrix(self):
        """Build the (N*N, N*N) system matrix with Dirichlet BCs baked in."""
        n = self.N
        size = n * n
        A = torch.zeros((size, size), device=self.device)
        h2 = self.h ** 2

        for i in range(n):
            for j in range(n):
                idx = self._idx(i, j)
                a_c = self.a_field[i, j]

                stencil_center = 0.0
                for di, dj in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                    ni, nj = i + di, j + dj
                    if 0 <= ni < n and 0 <= nj < n:
                        a_n = self.a_field[ni, nj]
                        a_half = 0.5 * (a_c + a_n)
                        A[idx, self._idx(ni, nj)] = -a_half / h2
                        stencil_center += a_half / h2
                    else:
                        # Neighbor is on the boundary (Dirichlet u=0): contributes
                        # only to the diagonal (the boundary value * coefficient
                        # moves to RHS, but is 0 for homogeneous Dirichlet).
                        a_boundary = a_c  # use center conductivity at boundary
                        stencil_center += a_boundary / h2

                A[idx, idx] = stencil_center

        return A

    def _build_rhs(self):
        """Flatten the forcing field into the RHS vector."""
        return self.f_field.reshape(-1)

    def compute_residual(self, u_flat):
        """Compute r = b - A @ u."""
        return self.b - self.A @ u_flat

    def solve_direct(self):
        """Direct solve via least-squares (for ground truth)."""
        u, *_ = torch.linalg.lstsq(self.A, self.b.unsqueeze(-1))
        return u.squeeze(-1).reshape(self.N, self.N)
