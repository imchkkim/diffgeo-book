import { h, render } from 'preact';
import { useState, useRef, useCallback } from 'preact/hooks';
import { useCanvas, usePointer } from './shared/canvas-utils.jsx';
import { Slider } from './shared/controls.jsx';
import { useThemeColors } from './shared/theme.jsx';
import {
  sphereToCart, project3D, vecScale, vecAdd, vecSub, vecCross, vecNormalize,
  drawSphereWireframe, drawArrow,
} from './shared/math.js';

const TAU = 2 * Math.PI;

function Ch02Viz() {
  const colors = useThemeColors();
  const [theta, setTheta] = useState(1.0);
  const [phi, setPhi] = useState(0.8);
  const [rotY, setRotY] = useState(-0.5);
  const [rotX, setRotX] = useState(0.25);
  const dragRef = useRef(null);

  const draw = useCallback((ctx, w, h) => {
    const cx = w / 2, cy = h / 2;
    const R = Math.min(w, h) * 0.35;

    drawSphereWireframe(ctx, cx, cy, R, rotY, rotX, colors.fgMuted);

    const pos = sphereToCart(theta, phi);
    const pScreen = project3D(vecScale(pos, R), cx, cy, 1, rotY, rotX);

    // Tangent vectors: d/dtheta and d/dphi
    const eTheta = vecNormalize([
      Math.cos(theta) * Math.cos(phi),
      Math.cos(theta) * Math.sin(phi),
      -Math.sin(theta),
    ]);
    const ePhi = vecNormalize([
      -Math.sin(phi),
      Math.cos(phi),
      0,
    ]);

    // Draw tangent plane (small parallelogram)
    const s = 0.35;
    const corners = [
      vecAdd(vecScale(pos, R), vecAdd(vecScale(eTheta, -s * R), vecScale(ePhi, -s * R))),
      vecAdd(vecScale(pos, R), vecAdd(vecScale(eTheta, s * R), vecScale(ePhi, -s * R))),
      vecAdd(vecScale(pos, R), vecAdd(vecScale(eTheta, s * R), vecScale(ePhi, s * R))),
      vecAdd(vecScale(pos, R), vecAdd(vecScale(eTheta, -s * R), vecScale(ePhi, s * R))),
    ].map(c => project3D(c, cx, cy, 1, rotY, rotX));

    ctx.fillStyle = 'rgba(33,150,243,0.15)';
    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    corners.slice(1).forEach(c => ctx.lineTo(c.x, c.y));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Tangent vectors as arrows
    const arrowLen = 0.22;
    const tTip = project3D(vecAdd(vecScale(pos, R), vecScale(eTheta, arrowLen * R)), cx, cy, 1, rotY, rotX);
    const pTip = project3D(vecAdd(vecScale(pos, R), vecScale(ePhi, arrowLen * R)), cx, cy, 1, rotY, rotX);

    ctx.strokeStyle = '#e53935';
    ctx.lineWidth = 2.5;
    drawArrow(ctx, pScreen.x, pScreen.y, tTip.x, tTip.y, 10);
    ctx.strokeStyle = '#43A047';
    drawArrow(ctx, pScreen.x, pScreen.y, pTip.x, pTip.y, 10);

    // Labels
    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#e53935';
    ctx.fillText('∂/∂θ', tTip.x + 6, tTip.y - 4);
    ctx.fillStyle = '#43A047';
    ctx.fillText('∂/∂φ', pTip.x + 6, pTip.y - 4);

    // Position dot
    ctx.fillStyle = colors.accent;
    ctx.beginPath();
    ctx.arc(pScreen.x, pScreen.y, 5, 0, TAU);
    ctx.fill();

    // Info
    ctx.fillStyle = colors.fgMuted;
    ctx.font = '12px sans-serif';
    ctx.fillText(`θ = ${theta.toFixed(2)}, φ = ${phi.toFixed(2)}`, 10, 20);
    ctx.fillText('접선공간 TₚM = 점 p에서의 모든 가능한 방향', 10, h - 12);
  }, [theta, phi, rotY, rotX, colors]);

  const canvasRef = useCanvas(draw, [draw]);

  usePointer(canvasRef, {
    onDown: (pos) => { dragRef.current = { x: pos.x, y: pos.y, rotY, rotX }; },
    onDrag: (pos) => {
      if (!dragRef.current) return;
      setRotY(dragRef.current.rotY + (pos.x - dragRef.current.x) * 0.01);
      setRotX(dragRef.current.rotX - (pos.y - dragRef.current.y) * 0.01);
    },
    onUp: () => { dragRef.current = null; },
  });

  return (
    <div class="viz-inner">
      <canvas ref={canvasRef} />
      <div class="viz-controls">
        <Slider label="θ (위도)" min={0.1} max={2.9} step={0.01} value={theta} onChange={setTheta} />
        <Slider label="φ (경도)" min={0} max={6.28} step={0.01} value={phi} onChange={setPhi} />
      </div>
    </div>
  );
}

export function mount(el) { render(<Ch02Viz />, el); }
