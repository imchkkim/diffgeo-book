import { h, render } from 'preact';
import { useState, useRef } from 'preact/hooks';
import { useCanvas } from './shared/canvas-utils.jsx';
import { Toggle } from './shared/controls.jsx';
import { useThemeColors } from './shared/theme.jsx';
import { drawArrow } from './shared/math.js';

function Ch04Viz() {
  const colors = useThemeColors();
  const [showCorrection, setShowCorrection] = useState(false);

  const drawRef = useRef(null);
  drawRef.current = (ctx, w, h) => {
    const cx = w / 2, cy = h / 2;
    const maxR = Math.min(w, h) * 0.42;

    // Draw polar coordinate grid
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 0.5;

    // Concentric circles
    for (let r = 1; r <= 4; r++) {
      const pr = (r / 4) * maxR;
      ctx.beginPath();
      ctx.arc(cx, cy, pr, 0, 2 * Math.PI);
      ctx.stroke();
    }

    // Radial lines
    for (let a = 0; a < 12; a++) {
      const angle = (a / 12) * 2 * Math.PI;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + maxR * Math.cos(angle), cy - maxR * Math.sin(angle));
      ctx.stroke();
    }

    // Vector field: constant vector field V = (1, 0) in Cartesian
    // In polar: V^r = cos(θ), V^θ = -sin(θ)/r
    // Partial derivatives of V^r w.r.t. r: 0, w.r.t. θ: -sin(θ)
    // But the COVARIANT derivative adds Christoffel correction

    const arrowScale = 22;

    for (let ri = 1; ri <= 4; ri++) {
      for (let ai = 0; ai < 8; ai++) {
        const r = ri;
        const theta = (ai / 8) * 2 * Math.PI;
        const pr = (r / 4) * maxR;
        const sx = cx + pr * Math.cos(theta);
        const sy = cy - pr * Math.sin(theta);

        if (showCorrection) {
          // True (covariant) derivative result: constant field stays constant
          // Arrow pointing in direction (1,0) Cartesian = rightward
          ctx.strokeStyle = '#43A047';
          ctx.lineWidth = 2;
          drawArrow(ctx, sx, sy, sx + arrowScale, sy, 7);
        } else {
          // Naive partial derivative in polar: components change with angle
          // V^r = cos(θ), V^θ = -sin(θ)/r
          // ∂V^r/∂θ = -sin(θ), ∂V^θ/∂θ = -cos(θ)/r
          // This gives a "phantom" variation that doesn't represent real change
          const Vr = Math.cos(theta);
          const Vt = -Math.sin(theta) / r;

          // Convert to screen coordinates
          const ex = sx + (Vr * Math.cos(theta) - Vt * r * Math.sin(theta)) * arrowScale;
          const ey = sy - (Vr * Math.sin(theta) + Vt * r * Math.cos(theta)) * arrowScale;

          ctx.strokeStyle = '#e53935';
          ctx.lineWidth = 2;
          drawArrow(ctx, sx, sy, ex, ey, 7);
        }
      }
    }

    // Labels
    ctx.font = 'bold 14px sans-serif';
    ctx.fillStyle = showCorrection ? '#43A047' : '#e53935';
    ctx.fillText(
      showCorrection ? '공변미분 (보정 적용) → 상수 벡터장이 상수로 보인다' :
      '편미분 (보정 없음) → 상수 벡터장이 변하는 것처럼 보인다',
      12, 22
    );

    ctx.fillStyle = colors.fgMuted;
    ctx.font = '12px sans-serif';
    ctx.fillText('벡터장: V = (1, 0) (데카르트 좌표에서 상수)', 12, h - 30);
    ctx.fillText(
      showCorrection ? 'Γ 보정이 좌표계의 잡음을 상쇄' : '극좌표에서 편미분하면 좌표 변화가 섞여 들어온다',
      12, h - 12
    );
  };

  const canvasRef = useCanvas(drawRef);

  return (
    <div class="viz-inner">
      <canvas ref={canvasRef} />
      <div class="viz-controls">
        <Toggle label={showCorrection ? 'Γ 보정 ON (공변미분)' : 'Γ 보정 OFF (편미분)'}
          value={showCorrection} onChange={setShowCorrection} />
      </div>
    </div>
  );
}

export function mount(el) { render(<Ch04Viz />, el); }
