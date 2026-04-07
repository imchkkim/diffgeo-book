import { h, render } from 'preact';
import { useState, useRef, useCallback } from 'preact/hooks';
import { useCanvas, usePointer } from './shared/canvas-utils.jsx';
import { Slider } from './shared/controls.jsx';
import { useThemeColors } from './shared/theme.jsx';
import {
  sphereToCart, project3D, vecScale, vecAdd, vecSub, vecNormalize, vecDot, vecCross,
  slerp, drawSphereWireframe, drawArrow, rotationMatrix, matVec3,
} from './shared/math.js';

const TAU = 2 * Math.PI;

function parallelTransportArc(vec, from, to, steps = 40) {
  let v = [...vec];
  for (let i = 0; i < steps; i++) {
    const p0 = vecNormalize(slerp(from, to, i / steps));
    const p1 = vecNormalize(slerp(from, to, (i + 1) / steps));
    const dot = Math.max(-1, Math.min(1, vecDot(p0, p1)));
    if (Math.abs(dot - 1) < 1e-12) continue;
    const axis = vecNormalize(vecCross(p0, p1));
    const R = rotationMatrix(axis, Math.acos(dot));
    v = matVec3(R, v);
    const comp = vecDot(v, p1);
    v = vecSub(v, vecScale(p1, comp));
    const n = Math.sqrt(vecDot(v, v));
    if (n > 1e-12) v = vecScale(v, Math.sqrt(vecDot(vec, vec)) / n);
  }
  return v;
}

function Ch07Viz() {
  const colors = useThemeColors();
  const [size, setSize] = useState(0.8);
  const rot = useRef({ y: -0.3, x: 0.35 });
  const dragRef = useRef(null);

  const drawRef = useRef(null);
  drawRef.current = (ctx, w, h) => {
    const cx = w / 2, cy = h / 2;
    const R = Math.min(w, h) * 0.36;
    const rotY = rot.current.y, rotX = rot.current.x;

    drawSphereWireframe(ctx, cx, cy, R, rotY, rotX, colors.fgMuted);

    // Parallelogram on sphere centered at (theta0, phi0)
    const theta0 = 0.8, phi0 = 0.4;
    const d = size * 0.3;

    const A = sphereToCart(theta0 - d, phi0 - d);
    const B = sphereToCart(theta0 - d, phi0 + d);
    const C = sphereToCart(theta0 + d, phi0 + d);
    const D = sphereToCart(theta0 + d, phi0 - d);
    const verts = [A, B, C, D];

    // Draw parallelogram
    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = 2;
    for (let e = 0; e < 4; e++) {
      const v0 = verts[e], v1 = verts[(e + 1) % 4];
      ctx.beginPath();
      for (let i = 0; i <= 20; i++) {
        const p = vecNormalize(slerp(v0, v1, i / 20));
        const pp = project3D(vecScale(p, R), cx, cy, 1, rotY, rotX);
        if (i === 0) ctx.moveTo(pp.x, pp.y); else ctx.lineTo(pp.x, pp.y);
      }
      ctx.stroke();
    }

    // Fill
    ctx.fillStyle = 'rgba(33,150,243,0.1)';
    ctx.beginPath();
    const steps = 10;
    for (let i = 0; i <= steps; i++) {
      const p = vecNormalize(slerp(A, B, i / steps));
      const pp = project3D(vecScale(p, R), cx, cy, 1, rotY, rotX);
      if (i === 0) ctx.moveTo(pp.x, pp.y); else ctx.lineTo(pp.x, pp.y);
    }
    for (let i = 0; i <= steps; i++) {
      const p = vecNormalize(slerp(B, C, i / steps));
      const pp = project3D(vecScale(p, R), cx, cy, 1, rotY, rotX);
      ctx.lineTo(pp.x, pp.y);
    }
    for (let i = 0; i <= steps; i++) {
      const p = vecNormalize(slerp(C, D, i / steps));
      const pp = project3D(vecScale(p, R), cx, cy, 1, rotY, rotX);
      ctx.lineTo(pp.x, pp.y);
    }
    for (let i = 0; i <= steps; i++) {
      const p = vecNormalize(slerp(D, A, i / steps));
      const pp = project3D(vecScale(p, R), cx, cy, 1, rotY, rotX);
      ctx.lineTo(pp.x, pp.y);
    }
    ctx.fill();

    // Initial vector at A
    let initVec = vecSub(B, vecScale(A, vecDot(A, B)));
    const initLen = Math.sqrt(vecDot(initVec, initVec));
    if (initLen > 1e-10) initVec = vecScale(initVec, 0.15 / initLen);

    // Transport A→B→C→D→A
    const path = [A, B, C, D, A];
    let vec = [...initVec];
    const trailColors = ['#e53935', '#FF9800', '#43A047', '#7B1FA2'];

    for (let leg = 0; leg < 4; leg++) {
      const from = path[leg], to = path[leg + 1];
      // Draw vector at start of leg
      const startP = project3D(vecScale(from, R), cx, cy, 1, rotY, rotX);
      const tipP = project3D(vecAdd(vecScale(from, R), vecScale(vec, R)), cx, cy, 1, rotY, rotX);
      ctx.strokeStyle = trailColors[leg];
      ctx.lineWidth = 2;
      drawArrow(ctx, startP.x, startP.y, tipP.x, tipP.y, 8);

      vec = parallelTransportArc(vec, from, to);
    }

    // Final vector at A (should differ from initial)
    const aScreen = project3D(vecScale(A, R), cx, cy, 1, rotY, rotX);
    const finalTip = project3D(vecAdd(vecScale(A, R), vecScale(vec, R)), cx, cy, 1, rotY, rotX);
    ctx.strokeStyle = '#e53935';
    ctx.lineWidth = 3;
    drawArrow(ctx, aScreen.x, aScreen.y, finalTip.x, finalTip.y, 10);

    // Initial vector (ghost)
    const ghostTip = project3D(vecAdd(vecScale(A, R), vecScale(initVec, R)), cx, cy, 1, rotY, rotX);
    ctx.strokeStyle = colors.fgMuted;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    drawArrow(ctx, aScreen.x, aScreen.y, ghostTip.x, ghostTip.y, 7);
    ctx.setLineDash([]);

    // Holonomy angle
    const dotP = vecDot(vecNormalize(initVec), vecNormalize(vec));
    const holAngle = Math.acos(Math.max(-1, Math.min(1, dotP)));
    const area = 4 * d * d; // approximate area of the patch

    ctx.fillStyle = colors.fg;
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(`회전각: ${(holAngle * 180 / Math.PI).toFixed(1)}°`, 12, 22);
    ctx.font = '13px sans-serif';
    ctx.fillStyle = colors.fgMuted;
    ctx.fillText(`≈ 넓이 × 곡률 (R=1 구면에서 K=1)`, 12, 42);
    ctx.fillText('드래그하여 회전', 12, h - 12);
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
    onUp: () => { dragRef.current = null; },
  });

  return (
    <div class="viz-inner">
      <canvas ref={canvasRef} />
      <div class="viz-controls">
        <Slider label="평행사변형 크기" min={0.2} max={1.5} step={0.01} value={size} onChange={setSize} />
      </div>
    </div>
  );
}

export function mount(el) { render(<Ch07Viz />, el); }
