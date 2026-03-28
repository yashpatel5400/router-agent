"""
Optional FNO (Fourier Neural Operator) surrogate for near-instant PDE inference.

When a pre-trained checkpoint is available, the surrogate can replace the iterative
SOR solver for dramatically faster design evaluations (~10-100x speedup).

Requires: pip install neuraloperator
"""

import os
import torch

try:
    from neuralop.models import FNO
    HAS_NEURALOP = True
except ImportError:
    HAS_NEURALOP = False


class FNOSurrogate:
    """
    Wraps a pre-trained FNO model for fast thermal field prediction.

    The FNO learns the mapping: forcing field f -> temperature field u
    for a fixed conductivity and grid size.
    """

    def __init__(self, N=31, trunc_mode=12, hidden_size=32, num_layers=2, device="cpu"):
        """
        Parameters
        ----------
        N : int
            Grid size the model was trained on.
        trunc_mode : int
            Number of Fourier modes to keep.
        hidden_size : int
            Hidden channel dimension.
        num_layers : int
            Number of FNO layers.
        device : str
            Torch device.
        """
        if not HAS_NEURALOP:
            raise ImportError(
                "neuraloperator package is required for the FNO surrogate. "
                "Install it with: pip install neuraloperator"
            )

        self.N = N
        self.device = device

        self.model = FNO(
            n_modes=(trunc_mode, trunc_mode),
            in_channels=1,
            out_channels=1,
            hidden_channels=hidden_size,
            n_layers=num_layers,
        ).to(device)
        self.model.eval()
        self._loaded = False

    def load_checkpoint(self, path):
        """Load a pre-trained FNO checkpoint."""
        if not os.path.exists(path):
            raise FileNotFoundError(f"Checkpoint not found: {path}")

        ckpt = torch.load(path, map_location=self.device, weights_only=False)

        if isinstance(ckpt, dict):
            if "model" in ckpt and isinstance(ckpt["model"], dict):
                state = {k: v for k, v in ckpt["model"].items() if k != "_metadata"}
                self.model.load_state_dict(state)
            elif "model_state_dict" in ckpt:
                self.model.load_state_dict(ckpt["model_state_dict"])
            else:
                self.model.load_state_dict(ckpt)
        else:
            self.model.load_state_dict(ckpt)

        self.model.eval()
        self._loaded = True

    @torch.no_grad()
    def predict(self, a_field, f_field):
        """
        Predict the temperature field from the forcing field.

        Parameters
        ----------
        a_field : torch.Tensor, shape (N, N)
            Conductivity field (currently unused by FNO which assumes uniform).
        f_field : torch.Tensor, shape (N, N)
            Forcing / heat source field.

        Returns
        -------
        u : torch.Tensor, shape (N, N)
            Predicted temperature field.
        """
        if not self._loaded:
            raise RuntimeError("No checkpoint loaded. Call load_checkpoint() first.")

        inp = f_field.unsqueeze(0).unsqueeze(0).to(self.device)  # (1, 1, N, N)
        out = self.model(inp)  # (1, 1, N, N)
        return out.squeeze(0).squeeze(0).cpu()

    def is_available(self):
        """Check if the surrogate is ready to use."""
        return HAS_NEURALOP and self._loaded


def get_default_checkpoint_path():
    """Return the default checkpoint path relative to the repo root."""
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(repo_root, "checkpoints", "fno_poisson_2d.pth")
