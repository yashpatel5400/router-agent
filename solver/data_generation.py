"""
Gaussian Random Field (GRF) generator for creating diverse forcing functions
and conductivity fields for 2D PDE problems.

Uses a spectral approach: sample Fourier coefficients with a power-law decay
and transform to physical space.
"""

import torch
import numpy as np


class GaussianRandomField:
    def __init__(self, N, alpha=2.0, tau=3.0, device="cpu"):
        """
        Parameters
        ----------
        N : int
            Grid resolution (generates an N×N field).
        alpha : float
            Smoothness exponent. Higher = smoother fields.
        tau : float
            Length scale parameter.
        device : str
            Torch device.
        """
        self.N = N
        self.device = device

        freqs = torch.fft.fftfreq(N, d=1.0 / N)
        kx, ky = torch.meshgrid(freqs, freqs, indexing="ij")
        k_mag = torch.sqrt(kx ** 2 + ky ** 2)
        k_mag[0, 0] = 1.0  # avoid division by zero

        self.spectrum = (tau ** 2 * (4 * np.pi ** 2 * k_mag ** 2 + tau ** 2)) ** (-alpha / 2.0)
        self.spectrum[0, 0] = 0.0  # zero mean
        self.spectrum = self.spectrum.to(device)

    def sample(self, n_samples=1):
        """
        Generate n_samples random fields of shape (n_samples, N, N).
        """
        xi = torch.randn(n_samples, self.N, self.N, device=self.device) + \
             1j * torch.randn(n_samples, self.N, self.N, device=self.device)
        coeffs = self.spectrum.unsqueeze(0) * xi
        fields = torch.fft.ifft2(coeffs).real
        # Normalize each sample to zero mean and unit variance
        fields = fields - fields.mean(dim=(-2, -1), keepdim=True)
        std = fields.std(dim=(-2, -1), keepdim=True)
        std[std < 1e-8] = 1.0
        fields = fields / std
        return fields
