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

function Ch01Viz() {
  const colors = useThemeColors();
  const [activeChart, setActiveChart] = useState(-1);
  const rot = useRef({ y: -0.6, x: 0.3 });
  const dragRef = useRef(null);

  const drawRef = useRef(null);
  drawRef.current = (ctx, w, h) => {
    const cx = w / 2, cy = h / 2;
    const R = Math.min(w, h) * 0.38;
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
          구면을 4개의 차트(좌표 패치)로 덮는 아틀라스. 어떤 단일 차트도 구면 전체를 덮을 수 없다.
        </span>
      </div>
    </div>
  );
}

export function mount(el) { render(<Ch01Viz />, el); }
