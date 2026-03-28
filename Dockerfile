FROM node:20-slim AS base

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv && \
    rm -rf /var/lib/apt/lists/*

RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

WORKDIR /app

# ── Install Node dependencies ──
COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN cd frontend && npm ci

# ── Copy application code ──
COPY . .

# ── Build Next.js ──
RUN cd frontend && npm run build

# ── Prune dev dependencies ──
RUN cd frontend && npm prune --omit=dev

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

WORKDIR /app/frontend
CMD ["npx", "next", "start", "-p", "8080"]
