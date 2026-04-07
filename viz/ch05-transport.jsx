import { h, render } from 'preact';
import { useState, useRef, useCallback, useEffect } from 'preact/hooks';
import { useCanvas, usePointer } from './shared/canvas-utils.jsx';
import { Slider } from './shared/controls.jsx';
import { useThemeColors } from './shared/theme.jsx';
import {
  sphereToCart, project3D, slerp, vecNormalize, vecCross, vecScale,
  vecAdd, vecSub, vecDot, drawArrow, drawSphereWireframe, rotationMatrix, matVec3,
} from './shared/math.js';

const TAU = 2 * Math.PI;

function parallelTransportAlongArc(vec, from, to, steps = 60) {
  let v = [...vec];
  for (let i = 0; i < steps; i++) {
    const t0 = i / steps;
    const t1 = (i + 1) / steps;
    const p0 = vecNormalize(slerp(from, to, t0));
    const p1 = vecNormalize(slerp(from, to, t1));
    const dot = Math.max(-1, Math.min(1, vecDot(p0, p1)));
    if (Math.abs(dot - 1) < 1e-12) continue;
    const axis = vecNormalize(vecCross(p0, p1));
    const angle = Math.acos(dot);
    const R = rotationMatrix(axis, angle);
    v = matVec3(R, v);
    // Project onto tangent plane of p1
    const comp = vecDot(v, p1);
    v = vecSub(v, vecScale(p1, comp));
    const n = Math.sqrt(vecDot(v, v));
    if (n > 1e-12) v = vecScale(v, Math.sqrt(vecDot(vec, vec)) / n);
  }
  return v;
}

function Ch05Viz() {
  const colors = useThemeColors();
  const [rotY, setRotY] = useState(-0.4);
  const [rotX, setRotX] = useState(0.3);
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [colatitude, setColatitude] = useState(1.2);
  const dragRef = useRef(null);
  const animRef = useRef(null);

  // Triangle vertices on unit sphere
  const A = sphereToCart(0, 0); // North pole
  const B = sphereToCart(colatitude, 0);
  const C = sphereToCart(colatitude, Math.PI / 2);

  // Total path: A→B→C→A, parameterized by progress [0,3]
  function getPositionAndVector(t) {
    const leg = Math.floor(Math.min(t, 2.999));
    const frac = t - leg;
    const verts = [A, B, C, A];
    const pos = vecNormalize(slerp(verts[leg], verts[leg + 1], frac));

    // Initial vector: tangent to the great circle A→B at A, projected onto tangent plane
    let initVec = vecSub(B, vecScale(A, vecDot(A, B)));
    const initLen = Math.sqrt(vecDot(initVec, initVec));
    if (initLen > 1e-10) initVec = vecScale(initVec, 0.3 / initLen);

    // Transport along completed legs
    let vec = [...initVec];
    const legs = [[A, B], [B, C], [C, A]];
    for (let i = 0; i < leg; i++) {
      vec = parallelTransportAlongArc(vec, legs[i][0], legs[i][1]);
    }
    // Transport along current partial leg
    const partialEnd = vecNormalize(slerp(verts[leg], verts[leg + 1], frac));
    vec = parallelTransportAlongArc(vec, verts[leg], partialEnd);

    return { pos, vec };
  }

  // Animation
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    function tick(now) {
      const dt = (now - last) / 1000;
      last = now;
      setProgress(p => {
        const next = p + dt * 0.5;
        if (next >= 3) { setPlaying(false); return 3; }
        return next;
      });
      animRef.current = requestAnimationFrame(tick);
    }
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [playing]);

  const draw = useCallback((ctx, w, h) => {
    const cx = w / 2;
    const cy = h / 2;
    const R = Math.min(w, h) * 0.35;

    // Sphere wireframe
    drawSphereWireframe(ctx, cx, cy, R, rotY, rotX, colors.fgMuted);

    // Triangle edges (great circle arcs)
    const verts = [A, B, C];
    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = 2;
    for (let e = 0; e < 3; e++) {
      const v0 = verts[e], v1 = verts[(e + 1) % 3];
      ctx.beginPath();
      for (let i = 0; i <= 40; i++) {
        const p = vecNormalize(slerp(v0, v1, i / 40));
        const pp = project3D(vecScale(p, R), cx, cy, 1, rotY, rotX);
        if (i === 0) ctx.moveTo(pp.x, pp.y); else ctx.lineTo(pp.x, pp.y);
      }
      ctx.stroke();
    }

    // Vertices
    for (const v of verts) {
      const pp = project3D(vecScale(v, R), cx, cy, 1, rotY, rotX);
      ctx.fillStyle = colors.accent;
      ctx.beginPath();
      ctx.arc(pp.x, pp.y, 4, 0, TAU);
      ctx.fill();
    }

    // Labels
    ctx.font = '14px sans-serif';
    ctx.fillStyle = colors.fg;
    const labels = ['A (북극)', 'B', 'C'];
    for (let i = 0; i < 3; i++) {
      const pp = project3D(vecScale(verts[i], R * 1.12), cx, cy, 1, rotY, rotX);
      ctx.fillText(labels[i], pp.x + 6, pp.y - 6);
    }

    // Current position and vector
    const { pos, vec } = getPositionAndVector(progress);
    const pScreen = project3D(vecScale(pos, R), cx, cy, 1, rotY, rotX);

    // Draw transported vector
    const tip = vecAdd(vecScale(pos, R), vecScale(vec, R));
    const tScreen = project3D(tip, cx, cy, 1, rotY, rotX);
    ctx.strokeStyle = '#e53935';
    ctx.lineWidth = 2.5;
    drawArrow(ctx, pScreen.x, pScreen.y, tScreen.x, tScreen.y, 10);

    // Draw position dot
    ctx.fillStyle = '#e53935';
    ctx.beginPath();
    ctx.arc(pScreen.x, pScreen.y, 5, 0, TAU);
    ctx.fill();

    // Show initial vector (ghost) at A
    if (progress > 0.1) {
      let initVec = vecSub(B, vecScale(A, vecDot(A, B)));
      const initLen = Math.sqrt(vecDot(initVec, initVec));
      if (initLen > 1e-10) initVec = vecScale(initVec, 0.3 / initLen);
      const ghostTip = vecAdd(vecScale(A, R), vecScale(initVec, R));
      const aScreen = project3D(vecScale(A, R), cx, cy, 1, rotY, rotX);
      const gScreen = project3D(ghostTip, cx, cy, 1, rotY, rotX);
      ctx.strokeStyle = colors.fgMuted;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      drawArrow(ctx, aScreen.x, aScreen.y, gScreen.x, gScreen.y, 8);
      ctx.setLineDash([]);
    }

    // Holonomy angle info
    if (progress >= 2.99) {
      // Calculate holonomy angle
      let initVec = vecSub(B, vecScale(A, vecDot(A, B)));
      const initLen = Math.sqrt(vecDot(initVec, initVec));
      if (initLen > 1e-10) initVec = vecScale(initVec, 0.3 / initLen);

      const finalVec = vec;
      const dotP = vecDot(vecNormalize(initVec), vecNormalize(finalVec));
      const holAngle = Math.acos(Math.max(-1, Math.min(1, dotP)));
      const degrees = (holAngle * 180 / Math.PI).toFixed(1);

      ctx.fillStyle = '#e53935';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText(`홀로노미: ${degrees}°`, 12, 28);
      ctx.font = '13px sans-serif';
      ctx.fillStyle = colors.fgMuted;
      ctx.fillText(`(구면 삼각형의 넓이 = ${(holAngle).toFixed(3)} rad)`, 12, 48);
    }
  }, [rotY, rotX, progress, colors, colatitude]);

  const canvasRef = useCanvas(draw, [draw]);

  usePointer(canvasRef, {
    onDown: (pos) => { dragRef.current = { x: pos.x, y: pos.y, rotY, rotX }; },
    onDrag: (pos) => {
      if (!dragRef.current) return;
      const dx = pos.x - dragRef.current.x;
      const dy = pos.y - dragRef.current.y;
      setRotY(dragRef.current.rotY + dx * 0.01);
      setRotX(dragRef.current.rotX - dy * 0.01);
    },
    onUp: () => { dragRef.current = null; },
  });

  return (
    <div class="viz-inner">
      <canvas ref={canvasRef} />
      <div class="viz-controls">
        <button
          style={{ padding: '0.3em 1em', borderRadius: '4px', border: `1px solid var(--border)`,
                   background: 'var(--bg-code)', color: 'var(--fg)', cursor: 'pointer' }}
          onClick={() => {
            if (progress >= 2.99) { setProgress(0); setTimeout(() => setPlaying(true), 50); }
            else setPlaying(!playing);
          }}>
          {playing ? '⏸ 일시정지' : progress >= 2.99 ? '↻ 다시' : '▶ 재생'}
        </button>
        <Slider label="진행" min={0} max={3} step={0.01} value={progress}
          onChange={(v) => { setPlaying(false); setProgress(v); }} />
        <Slider label="삼각형 크기" min={0.3} max={1.5} step={0.01} value={colatitude}
          onChange={(v) => { setColatitude(v); setProgress(0); }} />
      </div>
    </div>
  );
}

export function mount(el) {
  render(<Ch05Viz />, el);
}
