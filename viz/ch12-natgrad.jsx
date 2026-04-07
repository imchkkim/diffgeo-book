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

// Fisher information matrix (approximate, for demo)
// Using Hessian as proxy for Fisher in this visualization
function fisher(x, y) {
  const h = 0.01;
  const gx0 = gradLoss(x - h, y), gx1 = gradLoss(x + h, y);
  const gy0 = gradLoss(x, y - h), gy1 = gradLoss(x, y + h);
  const Fxx = ((gx1[0] - gx0[0]) / (2 * h));
  const Fxy = ((gy1[0] - gy0[0]) / (2 * h));
  const Fyy = ((gy1[1] - gy0[1]) / (2 * h));
  // Ensure positive definite
  const fxx = Math.abs(Fxx) + 0.1;
  const fyy = Math.abs(Fyy) + 0.1;
  const fxy = Fxy * 0.5;
  return [fxx, fxy, fxy, fyy];
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

function simulateTrajectory(x0, y0, lr, useNatural, maxSteps = 200) {
  const path = [[x0, y0]];
  let x = x0, y = y0;
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
    // Clip step size
    const step = Math.min(lr, 0.1 / norm);
    x -= step * dx;
    y -= step * dy;
    if (x < -2 || x > 3 || y < -1.5 || y > 4) break;
    path.push([x, y]);
    if (loss(x, y) < 0.001) break;
  }
  return path;
}

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
          const y1 = y0;

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
    ctx.fillStyle = '#43A047';
    ctx.beginPath();
    ctx.arc(minP.x, minP.y, 5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = colors.fg;
    ctx.font = '12px sans-serif';
    ctx.fillText('최솟값 (1,1)', minP.x + 8, minP.y + 4);

    // Simulate both trajectories
    const stdPath = simulateTrajectory(startX, startY, 0.003, false);
    const natPath = simulateTrajectory(startX, startY, 0.01, true);

    // Draw standard gradient path
    ctx.strokeStyle = '#e53935';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < stdPath.length; i++) {
      const p = toScreen(stdPath[i][0], stdPath[i][1]);
      if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();

    // Draw natural gradient path
    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i < natPath.length; i++) {
      const p = toScreen(natPath[i][0], natPath[i][1]);
      if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();

    // Start point
    const sp = toScreen(startX, startY);
    ctx.fillStyle = colors.fg;
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, 6, 0, TAU);
    ctx.fill();
    ctx.fillText('시작점', sp.x + 10, sp.y - 4);

    // End dots
    if (stdPath.length > 1) {
      const ep = toScreen(stdPath[stdPath.length - 1][0], stdPath[stdPath.length - 1][1]);
      ctx.fillStyle = '#e53935';
      ctx.beginPath(); ctx.arc(ep.x, ep.y, 4, 0, TAU); ctx.fill();
    }
    if (natPath.length > 1) {
      const ep = toScreen(natPath[natPath.length - 1][0], natPath[natPath.length - 1][1]);
      ctx.fillStyle = colors.accent;
      ctx.beginPath(); ctx.arc(ep.x, ep.y, 4, 0, TAU); ctx.fill();
    }

    // Legend
    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#e53935';
    ctx.fillText(`── 보통 경사 (${stdPath.length} 스텝)`, 12, 20);
    ctx.fillStyle = colors.accent;
    ctx.fillText(`━━ 자연 경사 F⁻¹∇L (${natPath.length} 스텝)`, 12, 38);
    ctx.fillStyle = colors.fgMuted;
    ctx.font = '12px sans-serif';
    ctx.fillText('자연 경사는 계량을 고려하여 더 효율적인 경로를 따른다', 12, h - 10);
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
          클릭하여 시작점 변경 · 등고선 = 손실 함수 · 자연 경사 = F⁻¹∇L
        </span>
      </div>
    </div>
  );
}

export function mount(el) { render(<Ch12Viz />, el); }
