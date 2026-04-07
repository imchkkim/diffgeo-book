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
    const cx = w / 2, cy = h * 0.42;
    const R = Math.min(w, h) * 0.30;
    const rotY = rot.current.y, rotX = rot.current.x;

    const COL_BLUE = colors.accent;
    const COL_ORANGE = '#FF9800';
    const COL_GREEN = '#43A047';
    const COL_RED = '#e53935';

    drawSphereWireframe(ctx, cx, cy, R, rotY, rotX, colors.fgMuted);

    // Parallelogram on sphere centered at (theta0, phi0)
    const theta0 = 0.8, phi0 = 0.4;
    const d = size * 0.3;

    const A = sphereToCart(theta0 - d, phi0 - d);
    const B = sphereToCart(theta0 - d, phi0 + d);
    const C = sphereToCart(theta0 + d, phi0 + d);
    const D = sphereToCart(theta0 + d, phi0 - d);
    const verts = [A, B, C, D];

    // Color-coded edges: A→B (u, blue), B→C (v, orange), C→D (u, blue), D→A (v, orange)
    const edgeColors = [COL_BLUE, COL_ORANGE, COL_BLUE, COL_ORANGE];
    for (let e = 0; e < 4; e++) {
      const v0 = verts[e], v1 = verts[(e + 1) % 4];
      ctx.strokeStyle = edgeColors[e];
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i <= 20; i++) {
        const p = vecNormalize(slerp(v0, v1, i / 20));
        const pp = project3D(vecScale(p, R), cx, cy, 1, rotY, rotX);
        if (i === 0) ctx.moveTo(pp.x, pp.y); else ctx.lineTo(pp.x, pp.y);
      }
      ctx.stroke();
    }

    // Fill
    ctx.fillStyle = 'rgba(33,150,243,0.08)';
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

    // Edge labels
    const midAB = vecNormalize(slerp(A, B, 0.5));
    const midBC = vecNormalize(slerp(B, C, 0.5));
    const ppU = project3D(vecScale(midAB, R * 1.1), cx, cy, 1, rotY, rotX);
    const ppV = project3D(vecScale(midBC, R * 1.1), cx, cy, 1, rotY, rotX);
    ctx.font = 'bold 13px sans-serif';
    ctx.fillStyle = COL_BLUE;
    ctx.fillText('u', ppU.x + 4, ppU.y - 4);
    ctx.fillStyle = COL_ORANGE;
    ctx.fillText('v', ppV.x + 4, ppV.y - 4);

    // Initial vector W at A (green)
    let initVec = vecSub(B, vecScale(A, vecDot(A, B)));
    const initLen = Math.sqrt(vecDot(initVec, initVec));
    if (initLen > 1e-10) initVec = vecScale(initVec, 0.15 / initLen);

    // Transport A→B→C→D→A with 4 leg colors
    const path = [A, B, C, D, A];
    let vec = [...initVec];
    // Leg colors: A→B = blue(u), B→C = orange(v), C→D = blue(u), D→A = orange(v)
    const trailColors = [COL_BLUE, COL_ORANGE, COL_BLUE, COL_ORANGE];

    for (let leg = 0; leg < 4; leg++) {
      const from = path[leg], to = path[leg + 1];
      const startP = project3D(vecScale(from, R), cx, cy, 1, rotY, rotX);
      const tipP = project3D(vecAdd(vecScale(from, R), vecScale(vec, R)), cx, cy, 1, rotY, rotX);
      ctx.strokeStyle = leg === 0 ? COL_GREEN : trailColors[leg];
      ctx.lineWidth = 2;
      drawArrow(ctx, startP.x, startP.y, tipP.x, tipP.y, 8);

      vec = parallelTransportArc(vec, from, to);
    }

    // Final vector at A (red — the rotated W)
    const aScreen = project3D(vecScale(A, R), cx, cy, 1, rotY, rotX);
    const finalTip = project3D(vecAdd(vecScale(A, R), vecScale(vec, R)), cx, cy, 1, rotY, rotX);
    ctx.strokeStyle = COL_RED;
    ctx.lineWidth = 3;
    drawArrow(ctx, aScreen.x, aScreen.y, finalTip.x, finalTip.y, 10);

    // Initial vector (ghost, green dashed)
    const ghostTip = project3D(vecAdd(vecScale(A, R), vecScale(initVec, R)), cx, cy, 1, rotY, rotX);
    ctx.strokeStyle = COL_GREEN;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    drawArrow(ctx, aScreen.x, aScreen.y, ghostTip.x, ghostTip.y, 7);
    ctx.setLineDash([]);

    // Holonomy angle
    const dotP = vecDot(vecNormalize(initVec), vecNormalize(vec));
    const holAngle = Math.acos(Math.max(-1, Math.min(1, dotP)));
    const area = 4 * d * d; // approximate area of the patch

    // --- Formula panel ---
    const panelY = h * 0.76;
    const panelX = 14;
    const lineH = 20;

    // Colored formula: R(u,v)W = nabla_u nabla_v W - nabla_v nabla_u W
    ctx.font = 'bold 14px monospace';
    let xOff = panelX;

    ctx.fillStyle = colors.fg;
    ctx.fillText('R(', xOff, panelY);
    xOff += ctx.measureText('R(').width;
    ctx.fillStyle = COL_BLUE;
    ctx.fillText('u', xOff, panelY);
    xOff += ctx.measureText('u').width;
    ctx.fillStyle = colors.fg;
    ctx.fillText(',', xOff, panelY);
    xOff += ctx.measureText(',').width;
    ctx.fillStyle = COL_ORANGE;
    ctx.fillText('v', xOff, panelY);
    xOff += ctx.measureText('v').width;
    ctx.fillStyle = colors.fg;
    ctx.fillText(')', xOff, panelY);
    xOff += ctx.measureText(')').width;
    ctx.fillStyle = COL_GREEN;
    ctx.fillText('W', xOff, panelY);
    xOff += ctx.measureText('W').width;
    ctx.fillStyle = colors.fg;
    ctx.fillText(' = \u2207', xOff, panelY);
    xOff += ctx.measureText(' = \u2207').width;
    ctx.fillStyle = COL_BLUE;
    ctx.font = 'bold 11px monospace';
    ctx.fillText('u', xOff, panelY + 3);
    xOff += ctx.measureText('u').width;
    ctx.font = 'bold 14px monospace';
    ctx.fillStyle = colors.fg;
    ctx.fillText('\u2207', xOff, panelY);
    xOff += ctx.measureText('\u2207').width;
    ctx.fillStyle = COL_ORANGE;
    ctx.font = 'bold 11px monospace';
    ctx.fillText('v', xOff, panelY + 3);
    xOff += ctx.measureText('v').width;
    ctx.font = 'bold 14px monospace';
    ctx.fillStyle = COL_GREEN;
    ctx.fillText('W', xOff, panelY);
    xOff += ctx.measureText('W').width;
    ctx.fillStyle = colors.fg;
    ctx.fillText(' \u2212 \u2207', xOff, panelY);
    xOff += ctx.measureText(' \u2212 \u2207').width;
    ctx.fillStyle = COL_ORANGE;
    ctx.font = 'bold 11px monospace';
    ctx.fillText('v', xOff, panelY + 3);
    xOff += ctx.measureText('v').width;
    ctx.font = 'bold 14px monospace';
    ctx.fillStyle = colors.fg;
    ctx.fillText('\u2207', xOff, panelY);
    xOff += ctx.measureText('\u2207').width;
    ctx.fillStyle = COL_BLUE;
    ctx.font = 'bold 11px monospace';
    ctx.fillText('u', xOff, panelY + 3);
    xOff += ctx.measureText('u').width;
    ctx.font = 'bold 14px monospace';
    ctx.fillStyle = COL_GREEN;
    ctx.fillText('W', xOff, panelY);

    // Numerical line
    const y2 = panelY + lineH + 2;
    ctx.font = '14px monospace';
    ctx.fillStyle = colors.fg;
    xOff = panelX;
    ctx.fillText('\uD68C\uC804\uAC01 \u2248 ', xOff, y2);
    xOff += ctx.measureText('\uD68C\uC804\uAC01 \u2248 ').width;
    ctx.fillStyle = COL_BLUE;
    ctx.fillText('Area', xOff, y2);
    xOff += ctx.measureText('Area').width;
    ctx.fillStyle = colors.fg;
    ctx.fillText(' \u00D7 K = ', xOff, y2);
    xOff += ctx.measureText(' \u00D7 K = ').width;
    ctx.fillStyle = COL_BLUE;
    ctx.fillText(area.toFixed(3), xOff, y2);
    xOff += ctx.measureText(area.toFixed(3)).width;
    ctx.fillStyle = colors.fg;
    ctx.fillText(' \u00D7 1.00 = ', xOff, y2);
    xOff += ctx.measureText(' \u00D7 1.00 = ').width;
    ctx.fillStyle = COL_RED;
    ctx.fillText(holAngle.toFixed(3) + ' rad', xOff, y2);

    // Legend
    const y3 = y2 + lineH;
    ctx.font = '12px monospace';
    ctx.fillStyle = COL_GREEN;
    ctx.fillText('\u25CF W(\uCD08\uAE30)', panelX, y3);
    ctx.fillStyle = COL_RED;
    ctx.fillText('\u25CF W(\uD68C\uC804)', panelX + 70, y3);
    ctx.fillStyle = COL_BLUE;
    ctx.fillText('\u2500 u\uBC29\uD5A5', panelX + 148, y3);
    ctx.fillStyle = COL_ORANGE;
    ctx.fillText('\u2500 v\uBC29\uD5A5', panelX + 218, y3);

    ctx.fillStyle = colors.fgMuted;
    ctx.font = '12px sans-serif';
    ctx.fillText('\uB4DC\uB798\uADF8\uD558\uC5EC \uD68C\uC804', panelX, h - 10);
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
