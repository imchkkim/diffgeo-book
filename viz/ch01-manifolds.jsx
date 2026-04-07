import { h, render } from 'preact';
import { useState, useRef } from 'preact/hooks';
import { useCanvas, usePointer } from './shared/canvas-utils.jsx';
import { useThemeColors } from './shared/theme.jsx';
import {
  sphereToCart, project3D, vecScale, drawSphereWireframe,
} from './shared/math.js';

const TAU = 2 * Math.PI;
const CHARTS = [
  { name: '차트 1 (앞면)', color: 'rgba(33,150,243,0.25)', border: '#2196F3',
    thetaRange: [0.2, 2.2], phiRange: [-1.2, 1.2] },
  { name: '차트 2 (뒷면)', color: 'rgba(76,175,80,0.25)', border: '#4CAF50',
    thetaRange: [0.2, 2.2], phiRange: [1.8, 4.2] },
  { name: '차트 3 (북극)', color: 'rgba(255,152,0,0.25)', border: '#FF9800',
    thetaRange: [0, 0.9], phiRange: [0, TAU] },
  { name: '차트 4 (남극)', color: 'rgba(233,30,99,0.25)', border: '#E91E63',
    thetaRange: [2.2, Math.PI], phiRange: [0, TAU] },
];

// Stereographic projection from north pole: φ_N(x,y,z) = (x/(1-z), y/(1-z))
function stereoNorth(x, y, z) {
  const denom = 1 - z;
  if (Math.abs(denom) < 1e-8) return null;
  return [x / denom, y / denom];
}

// Stereographic projection from south pole: φ_S(x,y,z) = (x/(1+z), y/(1+z))
function stereoSouth(x, y, z) {
  const denom = 1 + z;
  if (Math.abs(denom) < 1e-8) return null;
  return [x / denom, y / denom];
}

// Chart projection info — maps chart index to a description and projection
const CHART_PROJECTIONS = [
  { label: 'φ₁: U₁ → R²  (앞면 투영)',
    formula: (x, y, z) => [x / (1 - z), y / (1 - z)],
    formulaText: (x, y, z) => `φ₁(${x}, ${y}, ${z}) = (${x}/(1−${z}), ${y}/(1−${z}))`,
    proj: stereoNorth },
  { label: 'φ₂: U₂ → R²  (뒷면 투영)',
    formula: (x, y, z) => [x / (1 + z), y / (1 + z)],
    formulaText: (x, y, z) => `φ₂(${x}, ${y}, ${z}) = (${x}/(1+${z}), ${y}/(1+${z}))`,
    proj: stereoSouth },
  { label: 'φ₃: U₃ → R²  (북극 투영)',
    proj: stereoNorth },
  { label: 'φ₄: U₄ → R²  (남극 투영)',
    proj: stereoSouth },
];

function Ch01Viz() {
  const colors = useThemeColors();
  const [activeChart, setActiveChart] = useState(-1);
  const rot = useRef({ y: -0.6, x: 0.3 });
  const dragRef = useRef(null);

  const drawRef = useRef(null);
  drawRef.current = (ctx, w, h) => {
    const cx = w / 2, cy = h / 2;
    const R = Math.min(w, h) * 0.33;
    const { y: rotY, x: rotX } = rot.current;

    drawSphereWireframe(ctx, cx, cy, R, rotY, rotX, colors.fgMuted);

    CHARTS.forEach((chart, ci) => {
      const isActive = activeChart === ci;
      ctx.fillStyle = chart.color;
      ctx.strokeStyle = chart.border;
      ctx.lineWidth = isActive ? 2.5 : 1;
      ctx.globalAlpha = isActive ? 1 : 0.6;

      const tSteps = 16, pSteps = 24;
      for (let ti = 0; ti < tSteps; ti++) {
        for (let pi = 0; pi < pSteps; pi++) {
          const t0 = chart.thetaRange[0] + (ti / tSteps) * (chart.thetaRange[1] - chart.thetaRange[0]);
          const t1 = chart.thetaRange[0] + ((ti + 1) / tSteps) * (chart.thetaRange[1] - chart.thetaRange[0]);
          const p0 = chart.phiRange[0] + (pi / pSteps) * (chart.phiRange[1] - chart.phiRange[0]);
          const p1 = chart.phiRange[0] + ((pi + 1) / pSteps) * (chart.phiRange[1] - chart.phiRange[0]);

          const corners = [
            project3D(vecScale(sphereToCart(t0, p0), R), cx, cy, 1, rotY, rotX),
            project3D(vecScale(sphereToCart(t0, p1), R), cx, cy, 1, rotY, rotX),
            project3D(vecScale(sphereToCart(t1, p1), R), cx, cy, 1, rotY, rotX),
            project3D(vecScale(sphereToCart(t1, p0), R), cx, cy, 1, rotY, rotX),
          ];

          const avgZ = (corners[0].z + corners[1].z + corners[2].z + corners[3].z) / 4;
          if (avgZ < 0) continue;

          ctx.beginPath();
          ctx.moveTo(corners[0].x, corners[0].y);
          ctx.lineTo(corners[1].x, corners[1].y);
          ctx.lineTo(corners[2].x, corners[2].y);
          ctx.lineTo(corners[3].x, corners[3].y);
          ctx.closePath();
          ctx.fill();
        }
      }

      ctx.beginPath();
      for (let i = 0; i <= 40; i++) {
        const theta = chart.thetaRange[0] + (i / 40) * (chart.thetaRange[1] - chart.thetaRange[0]);
        const p = project3D(vecScale(sphereToCart(theta, chart.phiRange[0]), R), cx, cy, 1, rotY, rotX);
        if (p.z > 0) { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    });

    // Draw a sample point on the sphere when a chart is active
    if (activeChart >= 0) {
      const chart = CHARTS[activeChart];
      const projInfo = CHART_PROJECTIONS[activeChart];
      // Sample point at the center of the active chart
      const sampleTheta = (chart.thetaRange[0] + chart.thetaRange[1]) / 2;
      const samplePhi = (chart.phiRange[0] + chart.phiRange[1]) / 2;
      const pos = sphereToCart(sampleTheta, samplePhi);
      const [sx, sy, sz] = pos;
      const pScreen = project3D(vecScale(pos, R), cx, cy, 1, rotY, rotX);

      // Draw sample point
      ctx.fillStyle = chart.border;
      ctx.beginPath();
      ctx.arc(pScreen.x, pScreen.y, 5, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Compute chart coordinates
      const chartCoords = projInfo.proj(sx, sy, sz);

      // === Formula panel (top-right area) ===
      const panelX = w - 280;
      const panelY = 10;
      const lineH = 18;

      // Panel background
      ctx.fillStyle = (colors.bgCode || colors.bg);
      ctx.globalAlpha = 0.88;
      ctx.fillRect(panelX - 8, panelY - 4, 276, 130);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = chart.border;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(panelX - 8, panelY - 4, 276, 130);

      ctx.font = 'bold 12px monospace';
      ctx.fillStyle = chart.border;
      ctx.fillText(projInfo.label, panelX, panelY + 14);

      ctx.font = '12px monospace';

      // Sphere-space coordinates (in chart color)
      ctx.fillStyle = chart.border;
      ctx.fillText(`구면 좌표: (θ, φ) = (${sampleTheta.toFixed(2)}, ${samplePhi.toFixed(2)})`, panelX, panelY + 14 + lineH);

      // Cartesian coordinates
      ctx.fillStyle = colors.fg;
      ctx.fillText(`직교 좌표: (x,y,z) = (${sx.toFixed(2)}, ${sy.toFixed(2)}, ${sz.toFixed(2)})`, panelX, panelY + 14 + lineH * 2);

      // The mapping formula with color
      const isNorth = (activeChart === 0 || activeChart === 2);
      const sign = isNorth ? '−' : '+';
      const denomVal = isNorth ? (1 - sz) : (1 + sz);

      // Formula line: φ(x,y,z) = (x/(1±z), y/(1±z))
      let fy = panelY + 14 + lineH * 3.3;
      ctx.fillStyle = colors.fgMuted;
      ctx.fillText(`φ(`, panelX, fy);
      ctx.fillStyle = colors.accent; // blue for x
      ctx.fillText(`x`, panelX + ctx.measureText('φ(').width, fy);
      ctx.fillStyle = colors.fgMuted;
      const afterX = panelX + ctx.measureText('φ(x').width;
      ctx.fillText(`,`, afterX, fy);
      ctx.fillStyle = '#e53935'; // red for y
      ctx.fillText(`y`, afterX + ctx.measureText(', ').width, fy);
      ctx.fillStyle = colors.fgMuted;
      const afterY = afterX + ctx.measureText(', y').width;
      ctx.fillText(`,z) = (`, afterY, fy);
      // x/(1±z)
      const eqStart = afterY + ctx.measureText(',z) = (').width;
      ctx.fillStyle = colors.accent;
      ctx.fillText(`${sx.toFixed(2)}`, eqStart, fy);
      ctx.fillStyle = colors.fgMuted;
      const afterNum1 = eqStart + ctx.measureText(`${sx.toFixed(2)}`).width;
      ctx.fillText(`/(1${sign}${sz.toFixed(2)}), `, afterNum1, fy);
      // y/(1±z)
      const afterMid = afterNum1 + ctx.measureText(`/(1${sign}${sz.toFixed(2)}), `).width;
      ctx.fillStyle = '#e53935';
      ctx.fillText(`${sy.toFixed(2)}`, afterMid, fy);
      ctx.fillStyle = colors.fgMuted;
      const afterNum2 = afterMid + ctx.measureText(`${sy.toFixed(2)}`).width;
      ctx.fillText(`/(1${sign}${sz.toFixed(2)}))`, afterNum2, fy);

      // Result
      fy += lineH * 1.2;
      if (chartCoords) {
        ctx.fillStyle = chart.border;
        ctx.font = 'bold 12px monospace';
        ctx.fillText(`= (${chartCoords[0].toFixed(3)}, ${chartCoords[1].toFixed(3)})`, panelX + 12, fy);
      } else {
        ctx.fillStyle = '#e53935';
        ctx.font = 'bold 12px monospace';
        ctx.fillText('정의되지 않음 (특이점)', panelX + 12, fy);
      }

      // Description
      fy += lineH * 1.3;
      ctx.font = '11px sans-serif';
      ctx.fillStyle = colors.fgMuted;
      ctx.fillText(`● 점은 차트 중심의 샘플 좌표`, panelX, fy);
    }

    // Legend
    ctx.font = '13px sans-serif';
    CHARTS.forEach((chart, ci) => {
      const y = 20 + ci * 22;
      ctx.fillStyle = chart.border;
      ctx.fillRect(10, y - 8, 12, 12);
      ctx.fillStyle = activeChart === ci ? colors.fg : colors.fgMuted;
      ctx.fillText(chart.name, 28, y + 2);
    });

    ctx.fillStyle = colors.fgMuted;
    ctx.font = '12px sans-serif';
    ctx.fillText('드래그하여 회전 · 클릭하여 차트 선택', 10, h - 12);
  };

  const canvasRef = useCanvas(drawRef);

  usePointer(canvasRef, {
    onDown: (pos) => { dragRef.current = { mx: pos.x, my: pos.y, ry: rot.current.y, rx: rot.current.x }; },
    onDrag: (pos) => {
      if (!dragRef.current) return;
      rot.current = {
        y: dragRef.current.ry + (pos.x - dragRef.current.mx) * 0.01,
        x: dragRef.current.rx - (pos.y - dragRef.current.my) * 0.01,
      };
    },
    onClick: () => { setActiveChart(a => (a + 1) % (CHARTS.length + 1) - 1); },
    onUp: () => { dragRef.current = null; },
  });

  return (
    <div class="viz-inner">
      <canvas ref={canvasRef} />
      <div class="viz-controls">
        <span style={{ color: 'var(--fg-muted)', fontSize: '0.9em' }}>
          구면을 4개의 차트(좌표 패치)로 덮는 아틀라스. 클릭하면 좌표 사상 공식을 볼 수 있다.
        </span>
      </div>
    </div>
  );
}

export function mount(el) { render(<Ch01Viz />, el); }
