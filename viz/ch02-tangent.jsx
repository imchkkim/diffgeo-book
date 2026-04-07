import { h, render } from 'preact';
import { useState, useRef } from 'preact/hooks';
import { useCanvas, usePointer } from './shared/canvas-utils.jsx';
import { Slider } from './shared/controls.jsx';
import { useThemeColors } from './shared/theme.jsx';
import {
  sphereToCart, project3D, vecScale, vecAdd, vecNormalize,
  drawSphereWireframe, drawArrow,
} from './shared/math.js';

const TAU = 2 * Math.PI;
const RED = '#e53935';
const GREEN = '#43A047';

function Ch02Viz() {
  const colors = useThemeColors();
  const [theta, setTheta] = useState(1.0);
  const [phi, setPhi] = useState(0.8);
  const rot = useRef({ y: -0.5, x: 0.25 });
  const dragRef = useRef(null);

  const drawRef = useRef(null);
  drawRef.current = (ctx, w, h) => {
    const cx = w / 2, cy = h / 2;
    const R = Math.min(w, h) * 0.30;
    const { y: rotY, x: rotX } = rot.current;

    drawSphereWireframe(ctx, cx, cy, R, rotY, rotX, colors.fgMuted);

    const pos = sphereToCart(theta, phi);
    const pScreen = project3D(vecScale(pos, R), cx, cy, 1, rotY, rotX);

    const eTheta = vecNormalize([
      Math.cos(theta) * Math.cos(phi),
      Math.cos(theta) * Math.sin(phi),
      -Math.sin(theta),
    ]);
    const ePhi = vecNormalize([-Math.sin(phi), Math.cos(phi), 0]);

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

    const arrowLen = 0.22;
    const tTip = project3D(vecAdd(vecScale(pos, R), vecScale(eTheta, arrowLen * R)), cx, cy, 1, rotY, rotX);
    const pTip = project3D(vecAdd(vecScale(pos, R), vecScale(ePhi, arrowLen * R)), cx, cy, 1, rotY, rotX);

    ctx.strokeStyle = RED;
    ctx.lineWidth = 2.5;
    drawArrow(ctx, pScreen.x, pScreen.y, tTip.x, tTip.y, 10);
    ctx.strokeStyle = GREEN;
    drawArrow(ctx, pScreen.x, pScreen.y, pTip.x, pTip.y, 10);

    ctx.font = '13px sans-serif';
    ctx.fillStyle = RED;
    ctx.fillText('∂/∂θ', tTip.x + 6, tTip.y - 4);
    ctx.fillStyle = GREEN;
    ctx.fillText('∂/∂φ', pTip.x + 6, pTip.y - 4);

    ctx.fillStyle = colors.accent;
    ctx.beginPath();
    ctx.arc(pScreen.x, pScreen.y, 5, 0, TAU);
    ctx.fill();

    // === Formula panel ===
    const panelX = 10;
    const panelY = 6;
    const lineH = 17;
    const panelW = Math.min(340, w - 20);
    const panelH = 150;

    // Panel background
    ctx.fillStyle = (colors.bgCode || colors.bg);
    ctx.globalAlpha = 0.88;
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = colors.border || colors.fgMuted;
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX, panelY, panelW, panelH);

    const tx = panelX + 8;
    let ty = panelY + 16;

    // Current point
    ctx.font = '12px monospace';
    ctx.fillStyle = colors.fg;
    ctx.fillText(`p = (θ, φ) = (${theta.toFixed(2)}, ${phi.toFixed(2)})`, tx, ty);

    // General tangent vector decomposition
    ty += lineH * 1.3;
    ctx.fillStyle = colors.fg;
    ctx.fillText('v = v', tx, ty);
    const afterV1 = tx + ctx.measureText('v = v').width;
    ctx.font = '10px monospace';
    ctx.fillText('θ', afterV1, ty - 3);
    ctx.font = '12px monospace';
    const afterSup1 = afterV1 + ctx.measureText('θ').width + 1;
    ctx.fillText(' · ', afterSup1, ty);
    ctx.fillStyle = RED;
    ctx.fillText('∂/∂θ', afterSup1 + ctx.measureText(' · ').width, ty);
    const afterT = afterSup1 + ctx.measureText(' · ∂/∂θ').width;
    ctx.fillStyle = colors.fg;
    ctx.fillText(' + v', afterT, ty);
    ctx.font = '10px monospace';
    ctx.fillText('φ', afterT + ctx.measureText(' + v').width, ty - 3);
    ctx.font = '12px monospace';
    const afterSup2 = afterT + ctx.measureText(' + v').width + ctx.measureText('φ').width + 1;
    ctx.fillText(' · ', afterSup2, ty);
    ctx.fillStyle = GREEN;
    ctx.fillText('∂/∂φ', afterSup2 + ctx.measureText(' · ').width, ty);

    // ∂/∂θ basis vector components
    ty += lineH * 1.4;
    const cosT = Math.cos(theta), sinT = Math.sin(theta);
    const cosP = Math.cos(phi), sinP = Math.sin(phi);

    ctx.fillStyle = RED;
    ctx.font = 'bold 12px monospace';
    ctx.fillText('∂/∂θ', tx, ty);
    ctx.font = '12px monospace';
    ctx.fillStyle = colors.fg;
    ctx.fillText(` = (cosθ cosφ, cosθ sinφ, −sinθ)`, tx + ctx.measureText('∂/∂θ').width + 4, ty);

    ty += lineH;
    ctx.fillStyle = RED;
    ctx.fillText(`     = (${(cosT * cosP).toFixed(3)}, ${(cosT * sinP).toFixed(3)}, ${(-sinT).toFixed(3)})`, tx, ty);

    // ∂/∂φ basis vector components
    ty += lineH * 1.3;
    ctx.fillStyle = GREEN;
    ctx.font = 'bold 12px monospace';
    ctx.fillText('∂/∂φ', tx, ty);
    ctx.font = '12px monospace';
    ctx.fillStyle = colors.fg;
    ctx.fillText(` = (−sinφ, cosφ, 0)`, tx + ctx.measureText('∂/∂φ').width + 4, ty);

    ty += lineH;
    ctx.fillStyle = GREEN;
    ctx.fillText(`     = (${(-sinP).toFixed(3)}, ${cosP.toFixed(3)}, ${(0).toFixed(3)})`, tx, ty);

    // Bottom help text
    ctx.fillStyle = colors.fgMuted;
    ctx.font = '12px sans-serif';
    ctx.fillText('접선공간 TₚM = 점 p에서의 모든 가능한 방향', 10, h - 12);
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
        <Slider label="θ (위도)" min={0.1} max={2.9} step={0.01} value={theta} onChange={setTheta} />
        <Slider label="φ (경도)" min={0} max={6.28} step={0.01} value={phi} onChange={setPhi} />
      </div>
    </div>
  );
}

export function mount(el) { render(<Ch02Viz />, el); }
