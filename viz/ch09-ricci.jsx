import { h, render } from 'preact';
import { useState, useRef } from 'preact/hooks';
import { useCanvas } from './shared/canvas-utils.jsx';
import { Slider } from './shared/controls.jsx';
import { useThemeColors } from './shared/theme.jsx';

const TAU = 2 * Math.PI;

function Ch09Viz() {
  const colors = useThemeColors();
  const [curvature, setCurvature] = useState(0);

  const drawRef = useRef(null);
  drawRef.current = (ctx, w, h) => {
    const cx = w / 2, cy = h / 2;
    const R = Math.min(w, h) * 0.3;
    const K = curvature;

    // Draw geodesic "ball" boundary in 2D cross-section
    // In constant curvature space:
    // Circumference = 2π * S_K(r) where
    // K > 0: S_K(r) = sin(√K r)/√K
    // K = 0: S_K(r) = r
    // K < 0: S_K(r) = sinh(√|K| r)/√|K|

    function S_K(r) {
      if (Math.abs(K) < 0.01) return r;
      if (K > 0) return Math.sin(Math.sqrt(K) * r) / Math.sqrt(K);
      return Math.sinh(Math.sqrt(-K) * r) / Math.sqrt(-K);
    }

    // Draw background surface hint
    const bgSteps = 80;

    // Geodesic rays from center
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 0.5;
    for (let a = 0; a < 16; a++) {
      const angle = (a / 16) * TAU;
      ctx.beginPath();
      for (let i = 0; i <= bgSteps; i++) {
        const r = (i / bgSteps) * 2.5;
        const screenR = S_K(r) * R / 2.5;
        const x = cx + screenR * Math.cos(angle);
        const y = cy + screenR * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Concentric "circles" at equal geodesic distances
    for (let ri = 1; ri <= 5; ri++) {
      const r = ri * 0.5;
      const screenR = S_K(r) * R / 2.5;
      ctx.strokeStyle = colors.border;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.abs(screenR), 0, TAU);
      ctx.stroke();
    }

    // Euclidean reference circle (K=0)
    const refR = 1.5;
    const eucScreenR = refR * R / 2.5;
    ctx.strokeStyle = colors.fgMuted;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(cx, cy, eucScreenR, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);

    // Actual geodesic ball at same geodesic radius
    const actScreenR = Math.abs(S_K(refR)) * R / 2.5;
    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, actScreenR, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = 'rgba(33,150,243,0.1)';
    ctx.fill();

    // Center point
    ctx.fillStyle = colors.accent;
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, TAU);
    ctx.fill();

    // Volume comparison
    const eucVol = Math.PI * refR * refR;
    const actVol = K > 0
      ? (2 * Math.PI / K) * (1 - Math.cos(Math.sqrt(K) * refR))
      : K < 0
        ? (2 * Math.PI / (-K)) * (Math.cosh(Math.sqrt(-K) * refR) - 1)
        : eucVol;
    const ratio = (actVol / eucVol * 100).toFixed(1);

    // Info
    ctx.fillStyle = colors.fg;
    ctx.font = 'bold 15px sans-serif';
    let label = K > 0.01 ? `양의 곡률 (K = ${K.toFixed(2)})` :
                K < -0.01 ? `음의 곡률 (K = ${K.toFixed(2)})` :
                '곡률 0 (유클리드)';
    ctx.fillText(label, 12, 24);

    ctx.font = '13px sans-serif';
    ctx.fillStyle = colors.fgMuted;
    if (Math.abs(K) > 0.01) {
      ctx.fillText(`측지공 넓이 = 유클리드의 ${ratio}%`, 12, 46);
      ctx.fillText(
        K > 0 ? '양의 리치 곡률 → 측지선들이 수렴 → 부피 감소' :
        '음의 리치 곡률 → 측지선들이 발산 → 부피 증가',
        12, 66
      );
    }

    // Legend
    ctx.fillStyle = colors.accent;
    ctx.fillText('● 실제 측지공', 12, h - 28);
    ctx.fillStyle = colors.fgMuted;
    ctx.fillText('◌ 유클리드 기준 (같은 반지름)', 12, h - 10);
  };

  const canvasRef = useCanvas(drawRef);

  return (
    <div class="viz-inner">
      <canvas ref={canvasRef} />
      <div class="viz-controls">
        <Slider label="곡률 K" min={-2} max={2} step={0.01} value={curvature} onChange={setCurvature} />
      </div>
    </div>
  );
}

export function mount(el) { render(<Ch09Viz />, el); }
