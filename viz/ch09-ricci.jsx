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
    const cx = w / 2, cy = h * 0.42;
    const R = Math.min(w, h) * 0.26;
    const K = curvature;

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
    const ballColor = K > 0.01 ? '#2196F3' : K < -0.01 ? '#e53935' : colors.accent;
    ctx.strokeStyle = ballColor;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, actScreenR, 0, TAU);
    ctx.stroke();
    const ballAlpha = K > 0.01 ? 'rgba(33,150,243,0.1)' : K < -0.01 ? 'rgba(229,57,53,0.1)' : 'rgba(33,150,243,0.1)';
    ctx.fillStyle = ballAlpha;
    ctx.fill();

    // Center point
    ctx.fillStyle = ballColor;
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
    const ratio = (actVol / eucVol * 100);
    const correction = -K / 12 * refR * refR;
    const approxVol = Math.PI * refR * refR * (1 + correction);

    // --- Formula display at bottom ---
    const formulaY = h * 0.72;
    ctx.textAlign = 'left';

    // Title
    ctx.fillStyle = colors.fg;
    ctx.font = 'bold 14px sans-serif';
    let label = K > 0.01 ? `양의 곡률 (K = ${K.toFixed(2)})` :
                K < -0.01 ? `음의 곡률 (K = ${K.toFixed(2)})` :
                '곡률 0 (유클리드)';
    ctx.fillText(label, 12, formulaY - 26);

    // Formula line 1: Vol(B_r) = pi * r^2 * (1 - K/12 * r^2 + ...)
    ctx.font = '13px monospace';
    const rVal = refR.toFixed(1);
    const eucPart = `\u03C0 \u00D7 ${rVal}\u00B2`;
    const corrVal = correction;
    const corrSign = corrVal >= 0 ? '+' : '\u2212';
    const corrAbs = Math.abs(corrVal).toFixed(4);

    // Euclidean part in grey
    ctx.fillStyle = colors.fgMuted;
    const fLine1 = 'Vol(B) = ';
    ctx.fillText(fLine1, 12, formulaY);
    let xOff = 12 + ctx.measureText(fLine1).width;

    ctx.fillStyle = colors.fgMuted;
    const eucText = `${eucPart}`;
    ctx.fillText(eucText, xOff, formulaY);
    xOff += ctx.measureText(eucText).width;

    ctx.fillStyle = colors.fg;
    ctx.fillText(' \u00D7 (1 ', xOff, formulaY);
    xOff += ctx.measureText(' \u00D7 (1 ').width;

    // Correction part in color
    const corrColor = K > 0.01 ? '#2196F3' : K < -0.01 ? '#e53935' : colors.fgMuted;
    ctx.fillStyle = corrColor;
    const corrText = `${corrSign} ${corrAbs}`;
    ctx.fillText(corrText, xOff, formulaY);
    xOff += ctx.measureText(corrText).width;

    ctx.fillStyle = colors.fg;
    ctx.fillText(' + ...)', xOff, formulaY);

    // Formula line 2: breakdown of correction term
    ctx.font = '12px monospace';
    ctx.fillStyle = corrColor;
    const kSign = K >= 0 ? '' : '\u2212';
    const kAbs = Math.abs(K).toFixed(2);
    ctx.fillText(
      `  \u2514\u2500 \u2212K/12 \u00D7 r\u00B2 = \u2212(${kSign}${kAbs})/12 \u00D7 ${rVal}\u00B2 = ${corrSign}${corrAbs}`,
      12, formulaY + 18
    );

    // Formula line 3: actual computed value and ratio
    ctx.font = '13px monospace';
    ctx.fillStyle = colors.fg;
    ctx.fillText(`  = ${approxVol.toFixed(4)}`, 12, formulaY + 40);

    // Exact value and ratio
    ctx.fillStyle = colors.fg;
    ctx.font = '13px monospace';
    ctx.fillText(`정확한 넓이 = ${actVol.toFixed(4)}`, 12, formulaY + 62);

    // Ratio highlight
    ctx.fillStyle = ballColor;
    ctx.font = 'bold 13px monospace';
    ctx.fillText(`= 유클리드의 ${ratio.toFixed(1)}%`, 12, formulaY + 82);

    // Explanation
    ctx.fillStyle = colors.fgMuted;
    ctx.font = '12px sans-serif';
    if (K > 0.01) {
      ctx.fillText('양의 리치 곡률 \u2192 측지선 수렴 \u2192 부피 감소', 12, formulaY + 102);
    } else if (K < -0.01) {
      ctx.fillText('음의 리치 곡률 \u2192 측지선 발산 \u2192 부피 증가', 12, formulaY + 102);
    }

    // Legend at very bottom
    const legY = h - 14;
    ctx.font = '12px sans-serif';
    ctx.fillStyle = ballColor;
    ctx.fillText('\u25CF 실제 측지공', 12, legY);
    ctx.fillStyle = colors.fgMuted;
    ctx.fillText('\u25CC 유클리드 기준 (같은 반지름)', 160, legY);
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
