import { h, render } from 'preact';
import { useState, useRef } from 'preact/hooks';
import { useCanvas } from './shared/canvas-utils.jsx';
import { Select } from './shared/controls.jsx';
import { useThemeColors } from './shared/theme.jsx';

const TAU = 2 * Math.PI;

const SURFACES = [
  { value: 'sphere', label: '구면 (K > 0)' },
  { value: 'cylinder', label: '원통 (K = 0)' },
  { value: 'saddle', label: '안장면 (K < 0)' },
  { value: 'plane', label: '평면 (K = 0)' },
];

function Ch08Viz() {
  const colors = useThemeColors();
  const [surface, setSurface] = useState('sphere');

  const drawRef = useRef(null);
  drawRef.current = (ctx, w, h) => {
    const cx = w / 2, cy = h / 2;
    const S = Math.min(w, h) * 0.35;

    // Draw surface wireframe
    const steps = 30;

    function surfacePoint(u, v) {
      switch (surface) {
        case 'sphere':
          return [
            S * Math.sin(u) * Math.cos(v),
            -S * Math.cos(u) * 0.6 + S * 0.1,
            S * Math.sin(u) * Math.sin(v),
          ];
        case 'cylinder':
          return [
            S * 0.5 * Math.cos(v),
            -S * (u - Math.PI / 2) * 0.5,
            S * 0.5 * Math.sin(v),
          ];
        case 'saddle':
          const su = (u - Math.PI / 2) / Math.PI;
          const sv = (v - Math.PI) / Math.PI;
          return [
            su * S * 0.8,
            (su * su - sv * sv) * S * 0.4,
            sv * S * 0.8,
          ];
        case 'plane':
          return [
            (u - Math.PI / 2) / Math.PI * S * 0.9,
            0,
            (v - Math.PI) / Math.PI * S * 0.9,
          ];
      }
    }

    function proj(p) {
      const [x, y, z] = p;
      const rotY = -0.5, rotX = 0.3;
      const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
      let rx = x * cosY + z * sinY, rz = -x * sinY + z * cosY;
      const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
      let ry = y * cosX - rz * sinX;
      rz = y * sinX + rz * cosX;
      return { x: cx + rx, y: cy - ry, z: rz };
    }

    // U lines
    ctx.strokeStyle = colors.fgMuted;
    ctx.lineWidth = 0.7;
    ctx.globalAlpha = 0.4;
    for (let i = 0; i <= 10; i++) {
      const u = (i / 10) * Math.PI;
      ctx.beginPath();
      for (let j = 0; j <= steps; j++) {
        const v = (j / steps) * TAU;
        const p = proj(surfacePoint(u, v));
        if (j === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }

    // V lines
    for (let j = 0; j <= 12; j++) {
      const v = (j / 12) * TAU;
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const u = (i / steps) * Math.PI;
        const p = proj(surfacePoint(u, v));
        if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Draw a triangle on the surface and compute its angle sum
    const triU = [0.6, 1.2, 0.9];
    const triV = [2.5, 2.2, 3.5];
    const triPts = triU.map((u, i) => proj(surfacePoint(u, triV[i])));

    ctx.strokeStyle = '#e53935';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(triPts[0].x, triPts[0].y);
    triPts.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = 'rgba(233,30,99,0.15)';
    ctx.fill();

    // Gaussian curvature info
    let K, angleSum, kText;
    switch (surface) {
      case 'sphere': K = 1; angleSum = '> 180°'; kText = 'K = 1/r² > 0'; break;
      case 'cylinder': K = 0; angleSum = '= 180°'; kText = 'K = 0 (κ₁ × 0)'; break;
      case 'saddle': K = -1; angleSum = '< 180°'; kText = 'K < 0'; break;
      case 'plane': K = 0; angleSum = '= 180°'; kText = 'K = 0'; break;
    }

    ctx.fillStyle = colors.fg;
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(`가우스 곡률: ${kText}`, 12, 26);

    ctx.font = '14px sans-serif';
    ctx.fillStyle = colors.fgMuted;
    ctx.fillText(`삼각형 내각의 합 ${angleSum}`, 12, 50);

    if (surface === 'cylinder') {
      ctx.fillText('원통 = 종이를 말은 것 → 내재적으로 평평', 12, 72);
    } else if (surface === 'sphere') {
      ctx.fillText('구면은 평면으로 펼칠 수 없다 (K ≠ 0)', 12, 72);
    } else if (surface === 'saddle') {
      ctx.fillText('안장면: κ₁ > 0, κ₂ < 0 → K < 0', 12, 72);
    }

    // κ₁, κ₂ visualization at bottom
    ctx.fillStyle = colors.fgMuted;
    ctx.font = '12px sans-serif';
    switch (surface) {
      case 'sphere': ctx.fillText('κ₁ = 1/r, κ₂ = 1/r → K = κ₁κ₂ = 1/r²', 12, h - 12); break;
      case 'cylinder': ctx.fillText('κ₁ = 1/r, κ₂ = 0 → K = κ₁κ₂ = 0 (Theorema Egregium!)', 12, h - 12); break;
      case 'saddle': ctx.fillText('κ₁ > 0, κ₂ < 0 → K = κ₁κ₂ < 0', 12, h - 12); break;
      case 'plane': ctx.fillText('κ₁ = 0, κ₂ = 0 → K = 0', 12, h - 12); break;
    }
  };

  const canvasRef = useCanvas(drawRef);

  return (
    <div class="viz-inner">
      <canvas ref={canvasRef} />
      <div class="viz-controls">
        <Select label="곡면" options={SURFACES} value={surface} onChange={setSurface} />
        <span style={{ color: 'var(--fg-muted)', fontSize: '0.85em' }}>
          K = κ₁κ₂는 내재적 — 밖에서 보지 않고도 측정 가능
        </span>
      </div>
    </div>
  );
}

export function mount(el) { render(<Ch08Viz />, el); }
