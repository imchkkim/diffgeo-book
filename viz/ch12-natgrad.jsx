import { h, render } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { useCanvas } from './shared/canvas-utils.jsx';
import { useThemeColors } from './shared/theme.jsx';

const TAU = 2 * Math.PI;

// Loss landscape: Rosenbrock-like but with anisotropy
function loss(x, y) {
  return 2 * (1 - x) * (1 - x) + 10 * (y - x * x) * (y - x * x);
}

function gradLoss(x, y) {
  return [
    -4 * (1 - x) - 40 * x * (y - x * x),
    20 * (y - x * x),
  ];
}

// Fisher information matrix (Gauss-Newton Hessian approximation)
// For a least-squares loss L = Σ r_i², F ≈ J^T J (always positive semi-definite)
// This is the standard approximation used in practice (Gauss-Newton / Fisher)
function fisher(x, y) {
  // Rosenbrock-like: L = 2(1-x)² + 10(y-x²)²
  // Residuals: r1 = √2·(1-x), r2 = √10·(y-x²)
  // Jacobian: dr1/dx = -√2, dr1/dy = 0
  //           dr2/dx = -2√10·x, dr2/dy = √10
  const jr1x = -Math.SQRT2;
  const jr1y = 0;
  const jr2x = -2 * Math.sqrt(10) * x;
  const jr2y = Math.sqrt(10);

  // F = J^T J (guaranteed positive semi-definite)
  const fxx = jr1x * jr1x + jr2x * jr2x;
  const fxy = jr1x * jr1y + jr2x * jr2y;
  const fyy = jr1y * jr1y + jr2y * jr2y;

  // Add small regularization for numerical stability
  const reg = 0.5;
  return [fxx + reg, fxy, fxy, fyy + reg];
}

function invMat2(m) {
  const [a, b, c, d] = m;
  const det = a * d - b * c;
  if (Math.abs(det) < 1e-10) return [1, 0, 0, 1];
  return [d / det, -b / det, -c / det, a / det];
}

function matVec2(m, v) {
  return [m[0] * v[0] + m[1] * v[1], m[2] * v[0] + m[3] * v[1]];
}

function simulateTrajectory(x0, y0, useNatural, maxSteps = 500) {
  const path = [[x0, y0]];
  let x = x0, y = y0;
  // Same step size budget: each step moves at most `stepSize` in the relevant norm
  const stepSize = 0.05;
  for (let i = 0; i < maxSteps; i++) {
    const g = gradLoss(x, y);
    let dx, dy;
    if (useNatural) {
      const F = fisher(x, y);
      const Finv = invMat2(F);
      [dx, dy] = matVec2(Finv, g);
    } else {
      [dx, dy] = g;
    }
    const norm = Math.sqrt(dx * dx + dy * dy);
    if (norm < 1e-8) break;
    // Normalize direction, then take fixed step
    const scale = stepSize / norm;
    x -= scale * dx;
    y -= scale * dy;
    if (x < -2 || x > 3 || y < -1.5 || y > 4) break;
    path.push([x, y]);
    if (loss(x, y) < 0.001) break;
  }
  return path;
}

const COL_STD = '#e53935';
const COL_NAT = '#2196F3';
const COL_GREEN = '#43A047';

function Ch12Viz() {
  const colors = useThemeColors();
  const [startX, setStartX] = useState(-0.5);
  const [startY, setStartY] = useState(2.5);

  const drawRef = useRef(null);
  drawRef.current = (ctx, w, h) => {
    const xRange = [-1.5, 2.5], yRange = [-0.5, 3.5];
    const plotW = w, plotH = h;

    function toScreen(px, py) {
      return {
        x: (px - xRange[0]) / (xRange[1] - xRange[0]) * plotW,
        y: plotH - (py - yRange[0]) / (yRange[1] - yRange[0]) * plotH,
      };
    }

    // Draw contour lines
    const levels = [0.1, 0.5, 1, 2, 5, 10, 20, 50, 100, 200];
    const resolution = 2;

    for (const level of levels) {
      ctx.strokeStyle = colors.border;
      ctx.lineWidth = 0.8;
      ctx.globalAlpha = 0.5;

      for (let px = 0; px < plotW; px += resolution) {
        for (let py = 0; py < plotH; py += resolution) {
          const x0 = xRange[0] + (px / plotW) * (xRange[1] - xRange[0]);
          const y0 = yRange[0] + (1 - py / plotH) * (yRange[1] - yRange[0]);
          const x1 = x0 + (resolution / plotW) * (xRange[1] - xRange[0]);

          const v0 = loss(x0, y0);
          const v1 = loss(x1, y0);
          const v2 = loss(x0, y0 - (resolution / plotH) * (yRange[1] - yRange[0]));

          if ((v0 - level) * (v1 - level) < 0 || (v0 - level) * (v2 - level) < 0) {
            ctx.fillStyle = colors.border;
            ctx.fillRect(px, py, 1, 1);
          }
        }
      }
    }
    ctx.globalAlpha = 1;

    // Minimum point
    const minP = toScreen(1, 1);
    ctx.fillStyle = COL_GREEN;
    ctx.beginPath();
    ctx.arc(minP.x, minP.y, 5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = colors.fg;
    ctx.font = '12px sans-serif';
    ctx.fillText('\uCD5C\uC19F\uAC12 (1,1)', minP.x + 8, minP.y + 4);

    // Simulate both trajectories
    const stdPath = simulateTrajectory(startX, startY, false);
    const natPath = simulateTrajectory(startX, startY, true);

    // Draw standard gradient path
    ctx.strokeStyle = COL_STD;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < stdPath.length; i++) {
      const pt = toScreen(stdPath[i][0], stdPath[i][1]);
      if (i === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
    }
    ctx.stroke();

    // Draw natural gradient path
    ctx.strokeStyle = COL_NAT;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i < natPath.length; i++) {
      const pt = toScreen(natPath[i][0], natPath[i][1]);
      if (i === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
    }
    ctx.stroke();

    // --- Draw gradient vectors at start point ---
    const sp = toScreen(startX, startY);
    const g = gradLoss(startX, startY);
    const F = fisher(startX, startY);
    const Finv = invMat2(F);
    const ng = matVec2(Finv, g);

    // Normalize for display (scale to reasonable arrow length)
    const gNorm = Math.sqrt(g[0] * g[0] + g[1] * g[1]);
    const ngNorm = Math.sqrt(ng[0] * ng[0] + ng[1] * ng[1]);
    const arrowLen = 40;

    // Standard gradient arrow (red)
    if (gNorm > 1e-6) {
      const gScale = arrowLen / gNorm;
      const gx = sp.x - g[0] * gScale;
      const gy = sp.y + g[1] * gScale; // flip y for screen coords
      ctx.strokeStyle = COL_STD;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(sp.x, sp.y);
      ctx.lineTo(gx, gy);
      ctx.stroke();
      // Arrowhead
      const angle = Math.atan2(gy - sp.y, gx - sp.x);
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.lineTo(gx - 8 * Math.cos(angle - 0.4), gy - 8 * Math.sin(angle - 0.4));
      ctx.lineTo(gx - 8 * Math.cos(angle + 0.4), gy - 8 * Math.sin(angle + 0.4));
      ctx.closePath();
      ctx.fillStyle = COL_STD;
      ctx.fill();
    }

    // Natural gradient arrow (blue)
    if (ngNorm > 1e-6) {
      const ngScale = arrowLen / ngNorm;
      const ngx = sp.x - ng[0] * ngScale;
      const ngy = sp.y + ng[1] * ngScale;
      ctx.strokeStyle = COL_NAT;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(sp.x, sp.y);
      ctx.lineTo(ngx, ngy);
      ctx.stroke();
      // Arrowhead
      const angle = Math.atan2(ngy - sp.y, ngx - sp.x);
      ctx.beginPath();
      ctx.moveTo(ngx, ngy);
      ctx.lineTo(ngx - 8 * Math.cos(angle - 0.4), ngy - 8 * Math.sin(angle - 0.4));
      ctx.lineTo(ngx - 8 * Math.cos(angle + 0.4), ngy - 8 * Math.sin(angle + 0.4));
      ctx.closePath();
      ctx.fillStyle = COL_NAT;
      ctx.fill();
    }

    // Start point (on top of arrows)
    ctx.fillStyle = colors.fg;
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, 6, 0, TAU);
    ctx.fill();

    // End dots
    if (stdPath.length > 1) {
      const ep = toScreen(stdPath[stdPath.length - 1][0], stdPath[stdPath.length - 1][1]);
      ctx.fillStyle = COL_STD;
      ctx.beginPath(); ctx.arc(ep.x, ep.y, 4, 0, TAU); ctx.fill();
    }
    if (natPath.length > 1) {
      const ep = toScreen(natPath[natPath.length - 1][0], natPath[natPath.length - 1][1]);
      ctx.fillStyle = COL_NAT;
      ctx.beginPath(); ctx.arc(ep.x, ep.y, 4, 0, TAU); ctx.fill();
    }

    // --- Formula panel (top-left) ---
    // Semi-transparent background for readability
    ctx.fillStyle = colors.bg || '#ffffff';
    ctx.globalAlpha = 0.85;
    ctx.fillRect(4, 4, 310, 108);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 0.5;
    ctx.strokeRect(4, 4, 310, 108);

    ctx.textAlign = 'left';

    // Formula title
    ctx.font = 'bold 13px sans-serif';
    ctx.fillStyle = colors.fg;
    ctx.fillText('\u00F1\u2207L = F\u207B\u00B9 \u2207L', 12, 22);

    // Gradient vectors with actual values
    ctx.font = '12px monospace';
    ctx.fillStyle = COL_STD;
    ctx.fillText(`\u2207L = (${g[0].toFixed(2)}, ${g[1].toFixed(2)})`, 12, 40);

    // Fisher matrix
    ctx.fillStyle = colors.fgMuted;
    ctx.font = '11px monospace';
    ctx.fillText(`F = [[${F[0].toFixed(1)}, ${F[1].toFixed(1)}], [${F[2].toFixed(1)}, ${F[3].toFixed(1)}]]`, 12, 56);

    // Natural gradient
    ctx.fillStyle = COL_NAT;
    ctx.font = '12px monospace';
    ctx.fillText(`F\u207B\u00B9\u2207L = (${ng[0].toFixed(2)}, ${ng[1].toFixed(2)})`, 12, 72);

    // Step counts
    ctx.font = 'bold 12px sans-serif';
    ctx.fillStyle = COL_STD;
    ctx.fillText(`\uBCF4\uD1B5 \uACBD\uC0AC: ${stdPath.length} \uC2A4\uD15D`, 12, 90);
    ctx.fillStyle = COL_NAT;
    ctx.fillText(`\uC790\uC5F0 \uACBD\uC0AC: ${natPath.length} \uC2A4\uD15D`, 160, 90);

    // F != I note
    ctx.fillStyle = colors.fgMuted;
    ctx.font = '11px sans-serif';
    ctx.fillText('F \u2260 I \u2192 \uB9E4\uAC1C\uBCC0\uC218 \uACF5\uAC04\uC774 \uD718\uC5B4\uC838 \uBC29\uD5A5\uC774 \uB2E4\uB984', 12, 106);

    // Bottom instruction
    ctx.fillStyle = colors.fgMuted;
    ctx.font = '12px sans-serif';
    ctx.fillText('\uD074\uB9AD\uD558\uC5EC \uC2DC\uC791\uC810 \uBCC0\uACBD', 12, h - 10);
  };

  const canvasRef = useCanvas(drawRef);

  // Click to set start point
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    function onClick(e) {
      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const x = -1.5 + (px / rect.width) * 4;
      const y = -0.5 + (1 - py / rect.height) * 4;
      setStartX(x);
      setStartY(y);
    }
    canvas.addEventListener('click', onClick);
    return () => canvas.removeEventListener('click', onClick);
  }, [canvasRef.current]);

  return (
    <div class="viz-inner">
      <canvas ref={canvasRef} />
      <div class="viz-controls">
        <span style={{ color: 'var(--fg-muted)', fontSize: '0.85em' }}>
          \uD074\uB9AD\uD558\uC5EC \uC2DC\uC791\uC810 \uBCC0\uACBD \u00B7 \uBE68\uAC04 \uD654\uC0B4\uD45C = \u2207L \u00B7 \uD30C\uB780 \uD654\uC0B4\uD45C = F\u207B\u00B9\u2207L
        </span>
      </div>
    </div>
  );
}

export function mount(el) { render(<Ch12Viz />, el); }
