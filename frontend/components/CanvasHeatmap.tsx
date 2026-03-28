"use client";

import { useRef, useEffect, useCallback, useState, type FC } from "react";

/* ── Inferno colormap (256 stops sampled from matplotlib's inferno) ── */

const INFERNO_STOPS: [number, number, number][] = [
  [0, 0, 4],
  [1, 0, 11],
  [2, 1, 18],
  [4, 2, 26],
  [7, 3, 34],
  [11, 4, 42],
  [16, 5, 50],
  [22, 7, 56],
  [28, 8, 62],
  [34, 10, 68],
  [40, 11, 74],
  [47, 12, 78],
  [53, 13, 82],
  [60, 14, 86],
  [66, 15, 89],
  [73, 15, 91],
  [80, 16, 93],
  [87, 16, 94],
  [94, 17, 95],
  [100, 18, 96],
  [107, 19, 96],
  [114, 20, 95],
  [120, 22, 94],
  [127, 24, 93],
  [133, 26, 91],
  [139, 28, 89],
  [145, 31, 87],
  [151, 34, 84],
  [157, 37, 81],
  [162, 40, 78],
  [167, 44, 74],
  [172, 47, 70],
  [177, 51, 67],
  [181, 55, 63],
  [186, 59, 59],
  [190, 63, 55],
  [194, 67, 51],
  [198, 72, 47],
  [201, 76, 44],
  [205, 81, 40],
  [208, 85, 37],
  [211, 90, 34],
  [214, 95, 30],
  [217, 100, 27],
  [219, 105, 24],
  [222, 110, 21],
  [224, 116, 18],
  [226, 121, 15],
  [228, 127, 12],
  [229, 133, 10],
  [231, 139, 9],
  [232, 145, 8],
  [233, 152, 8],
  [234, 158, 10],
  [234, 165, 12],
  [234, 172, 17],
  [234, 179, 22],
  [233, 186, 29],
  [232, 193, 37],
  [230, 200, 47],
  [228, 207, 58],
  [226, 214, 70],
  [252, 255, 164],
];

function sampleInferno(t: number): [number, number, number] {
  const n = INFERNO_STOPS.length - 1;
  const idx = Math.max(0, Math.min(n, t * n));
  const lo = Math.floor(idx);
  const hi = Math.min(lo + 1, n);
  const f = idx - lo;
  const a = INFERNO_STOPS[lo];
  const b = INFERNO_STOPS[hi];
  return [
    Math.round(a[0] + (b[0] - a[0]) * f),
    Math.round(a[1] + (b[1] - a[1]) * f),
    Math.round(a[2] + (b[2] - a[2]) * f),
  ];
}

/* ── Component ── */

type Source = { x: number; y: number; intensity: number; radius: number };
type ConductivityRegion = { x: number; y: number; radius: number; value: number };

interface CanvasHeatmapProps {
  temperatureField: number[][];
  sources?: Source[];
  conductivityRegions?: ConductivityRegion[];
}

type HoverInfo = {
  cssX: number;
  cssY: number;
  temp: number;
  domainX: number;
  domainY: number;
};

type LayoutInfo = {
  heatmapX: number;
  heatmapY: number;
  heatmapWidth: number;
  heatmapHeight: number;
  rows: number;
  cols: number;
};

export const CanvasHeatmap: FC<CanvasHeatmapProps> = ({
  temperatureField,
  sources,
  conductivityRegions,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layoutRef = useRef<LayoutInfo | null>(null);
  const [hover, setHover] = useState<HoverInfo | null>(null);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const layout = layoutRef.current;
      const container = containerRef.current;
      if (!layout || !container) return;

      const rect = container.getBoundingClientRect();
      const cssX = e.clientX - rect.left;
      const cssY = e.clientY - rect.top;

      const { heatmapX, heatmapY, heatmapWidth, heatmapHeight, rows, cols } = layout;
      const relX = cssX - heatmapX;
      const relY = cssY - heatmapY;

      if (relX < 0 || relX >= heatmapWidth || relY < 0 || relY >= heatmapHeight) {
        setHover(null);
        return;
      }

      const gridC = Math.floor((relX / heatmapWidth) * cols);
      const gridR = rows - 1 - Math.floor((relY / heatmapHeight) * rows);
      const clampedR = Math.max(0, Math.min(rows - 1, gridR));
      const clampedC = Math.max(0, Math.min(cols - 1, gridC));

      const temp = temperatureField[clampedR]?.[clampedC] ?? 0;
      const domainX = (clampedR + 1) / (rows + 1);
      const domainY = (clampedC + 1) / (cols + 1);

      setHover({ cssX, cssY, temp, domainX, domainY });
    },
    [temperatureField],
  );

  const handleMouseLeave = useCallback(() => setHover(null), []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rows = temperatureField.length;
    const cols = temperatureField[0]?.length ?? 0;
    if (rows === 0 || cols === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    const w = Math.round(rect.width * dpr);
    const h = Math.round(rect.height * dpr);
    if (w === 0 || h === 0) return;

    canvas.width = w;
    canvas.height = h;
    ctx.scale(dpr, dpr);

    const cssW = rect.width;
    const cssH = rect.height;

    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, cssW, cssH);

    const colorBarWidth = 60;
    const barPadding = 10;
    const availW = cssW - colorBarWidth - barPadding;
    const availH = cssH;

    const fieldAspect = cols / rows;
    let heatmapWidth: number;
    let heatmapHeight: number;
    if (availW / availH > fieldAspect) {
      heatmapHeight = availH;
      heatmapWidth = availH * fieldAspect;
    } else {
      heatmapWidth = availW;
      heatmapHeight = availW / fieldAspect;
    }
    const heatmapX = (availW - heatmapWidth) / 2;
    const heatmapY = (availH - heatmapHeight) / 2;

    let tMin = Infinity;
    let tMax = -Infinity;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const v = temperatureField[r][c];
        if (v < tMin) tMin = v;
        if (v > tMax) tMax = v;
      }
    }
    const tRange = tMax - tMin || 1;

    const imgData = ctx.createImageData(cols, rows);
    for (let r = 0; r < rows; r++) {
      const flippedR = rows - 1 - r;
      for (let c = 0; c < cols; c++) {
        const t = (temperatureField[flippedR][c] - tMin) / tRange;
        const [cr, cg, cb] = sampleInferno(t);
        const idx = (r * cols + c) * 4;
        imgData.data[idx] = cr;
        imgData.data[idx + 1] = cg;
        imgData.data[idx + 2] = cb;
        imgData.data[idx + 3] = 255;
      }
    }

    const offscreen = new OffscreenCanvas(cols, rows);
    const offCtx = offscreen.getContext("2d")!;
    offCtx.putImageData(imgData, 0, 0);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(offscreen, heatmapX, heatmapY, heatmapWidth, heatmapHeight);

    if (conductivityRegions && conductivityRegions.length > 0) {
      ctx.strokeStyle = "#4ade80";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      for (const region of conductivityRegions) {
        const cx = heatmapX + region.y * heatmapWidth;
        const cy = heatmapY + (1 - region.x) * heatmapHeight;
        const rx = region.radius * heatmapWidth;
        const ry = region.radius * heatmapHeight;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    if (sources && sources.length > 0) {
      const cellW = heatmapWidth / cols;
      for (const src of sources) {
        const sx = heatmapX + src.y * heatmapWidth;
        const sy = heatmapY + (1 - src.x) * heatmapHeight;
        const size = Math.max(6, Math.min(12, cellW * 0.8));

        ctx.fillStyle = "#22d3ee";
        ctx.strokeStyle = "#0a0a0a";
        ctx.lineWidth = 1.5;

        ctx.beginPath();
        ctx.moveTo(sx, sy - size);
        ctx.lineTo(sx - size * 0.7, sy + size * 0.5);
        ctx.lineTo(sx + size * 0.7, sy + size * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }

    /* ── Color bar ── */
    const barX = availW + barPadding;
    const barW = 16;
    const barTop = heatmapY + 4;
    const barBottom = heatmapY + heatmapHeight - 4;
    const barH = barBottom - barTop;

    for (let y = 0; y < barH; y++) {
      const t = 1 - y / barH;
      const [cr, cg, cb] = sampleInferno(t);
      ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
      ctx.fillRect(barX, barTop + y, barW, 1);
    }

    ctx.strokeStyle = "#3f3f46";
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barTop, barW, barH);

    ctx.fillStyle = "#a1a1aa";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "left";

    const tickCount = 5;
    for (let i = 0; i <= tickCount; i++) {
      const frac = i / tickCount;
      const val = tMax - frac * tRange;
      const y = barTop + frac * barH;
      ctx.fillText(val.toFixed(2), barX + barW + 4, y + 4);
      ctx.beginPath();
      ctx.moveTo(barX + barW, y);
      ctx.lineTo(barX + barW + 2, y);
      ctx.strokeStyle = "#a1a1aa";
      ctx.stroke();
    }

    layoutRef.current = { heatmapX, heatmapY, heatmapWidth, heatmapHeight, rows, cols };
  }, [temperatureField, sources, conductivityRegions]);

  useEffect(() => {
    draw();
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(container);
    return () => ro.disconnect();
  }, [draw]);

  const layout = layoutRef.current;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ width: "100%", height: "100%", position: "relative", cursor: hover ? "crosshair" : "default" }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block" }}
      />

      {hover && layout && (
        <>
          {/* Vertical crosshair */}
          <div
            style={{
              position: "absolute",
              left: hover.cssX,
              top: layout.heatmapY,
              width: 1,
              height: layout.heatmapHeight,
              backgroundColor: "rgba(255,255,255,0.3)",
              pointerEvents: "none",
            }}
          />
          {/* Horizontal crosshair */}
          <div
            style={{
              position: "absolute",
              left: layout.heatmapX,
              top: hover.cssY,
              width: layout.heatmapWidth,
              height: 1,
              backgroundColor: "rgba(255,255,255,0.3)",
              pointerEvents: "none",
            }}
          />
          {/* Tooltip */}
          <div
            style={{
              position: "absolute",
              left: hover.cssX + 12,
              top: hover.cssY - 40,
              pointerEvents: "none",
              backgroundColor: "rgba(0,0,0,0.85)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 6,
              padding: "4px 8px",
              whiteSpace: "nowrap",
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: "#f97316", fontFamily: "monospace" }}>
              T = {hover.temp.toFixed(4)}
            </div>
            <div style={{ fontSize: 10, color: "#a1a1aa", fontFamily: "monospace" }}>
              ({hover.domainX.toFixed(3)}, {hover.domainY.toFixed(3)})
            </div>
          </div>
        </>
      )}
    </div>
  );
};
