// 2장 — 구면 위 한 점의 접평면과 곡선 속도의 기저 분해.
// 점 p = (θ, φ), 성분 (v^θ, v^φ) → 곡선 γ(t) = (θ + v^θ t, φ + v^φ t), 속도 γ'(0) = v^θ ∂θ + v^φ ∂φ.
// 색: 좌표 θ, φ = coord / 기저 ∂θ, ∂φ = dir / 곡선과 속도 = curve (palette.json).
import { render } from 'preact';
import { useState, useRef } from 'preact/hooks';
import { useCanvas, usePointer } from './shared/canvas-utils.jsx';
import { Slider } from './shared/controls.jsx';
import { useThemeColors } from './shared/theme.jsx';
import { usePalette, HEX } from './shared/palette.js';
import { Tex } from './shared/tex.jsx';
import { project3D, drawArrow } from './shared/math.js';

const TAU = 2 * Math.PI;

// 구면 위치와 좌표 기저 (반지름 1)
const pos = (t, f) => [Math.sin(t) * Math.cos(f), Math.sin(t) * Math.sin(f), Math.cos(t)];
const dTheta = (t, f) => [Math.cos(t) * Math.cos(f), Math.cos(t) * Math.sin(f), -Math.sin(t)];
const dPhi = (t, f) => [-Math.sin(t) * Math.sin(f), Math.sin(t) * Math.cos(f), 0];
const add = (a, b) => a.map((v, i) => v + b[i]);
const mul = (a, s) => a.map(v => v * s);

function Ch02Viz() {
  const colors = useThemeColors();
  const pal = usePalette();
  const [theta, setTheta] = useState(1.2);
  const [phi, setPhi] = useState(0.6);
  const [vt, setVt] = useState(-0.5);
  const [vf, setVf] = useState(1.0);
  const rot = useRef({ y: -0.2, x: 0.35 });
  const drag = useRef(null);

  const drawRef = useRef(null);
  drawRef.current = (ctx, w, h) => {
    const cx = w / 2, cy = h / 2 + 4;
    const R = Math.min(w, h) * 0.36;
    const { y: ry, x: rx } = rot.current;
    // 화면 위쪽 = 북극(Z)
    const pr = (q) => project3D([q[0] * R, q[2] * R, q[1] * R], cx, cy, 1, ry, rx);

    // 구면 윤곽과 격자
    ctx.strokeStyle = colors.border; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
    function curve3(fn, n, style, width, dash, back = false) {
      ctx.strokeStyle = style; ctx.lineWidth = width; ctx.setLineDash(dash || []);
      let on = false;
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const q = pr(fn(i / n));
        if (q.z >= 0 || back) { if (!on) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y); on = true; }
        else on = false;
      }
      ctx.stroke(); ctx.setLineDash([]);
    }
    for (let k = 1; k < 6; k++) {
      const t = (k / 6) * Math.PI;
      curve3(u => pos(t, TAU * u), 72, colors.border, 1);
    }
    for (let k = 0; k < 12; k++) {
      const f = (k / 12) * TAU;
      curve3(u => pos(Math.PI * u, f), 48, colors.border, 1);
    }
    // 점 p 를 지나는 좌표선: θ 선(경선), φ 선(위선)
    curve3(u => pos(Math.PI * u, phi), 64, pal.coord, 1.2, [4, 3]);
    curve3(u => pos(theta, TAU * u), 96, pal.coord, 1.2, [4, 3]);

    const p = pos(theta, phi);
    const eT = dTheta(theta, phi), eF = dPhi(theta, phi);
    const n = p; // 바깥 법선

    // 접평면 조각 (단위 정규직교틀로 그린 정사각형)
    const uT = eT, uF = [-Math.sin(phi), Math.cos(phi), 0];
    const s = 0.62;
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]]
      .map(([a, b]) => pr(add(p, add(mul(uT, a * s), mul(uF, b * s)))));
    const facing = project3D([n[0], n[2], n[1]], 0, 0, 1, ry, rx).z;
    ctx.fillStyle = pal.dir; ctx.globalAlpha = facing > 0 ? 0.1 : 0.05;
    ctx.beginPath(); corners.forEach((c, i) => i ? ctx.lineTo(c.x, c.y) : ctx.moveTo(c.x, c.y)); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 0.5; ctx.strokeStyle = pal.dir; ctx.lineWidth = 1; ctx.stroke(); ctx.globalAlpha = 1;
    const lab = pr(add(p, add(mul(uT, s), mul(uF, s))));
    ctx.fillStyle = colors.fgMuted; ctx.font = 'italic 13px serif';
    ctx.fillText('T', lab.x + 4, lab.y);
    ctx.font = 'italic 9px serif'; ctx.fillText('p', lab.x + 12, lab.y + 4);
    ctx.font = 'italic 13px serif'; ctx.fillText('S²', lab.x + 18, lab.y);

    // 곡선 γ(t) = (θ + v^θ t, φ + v^φ t)
    const T = 0.9;
    curve3(u => {
      const t = (u * 2 - 1) * T;
      return pos(Math.min(Math.PI - 1e-3, Math.max(1e-3, theta + vt * t)), phi + vf * t);
    }, 80, pal.curve, 2.5, null);

    // 화살표
    const ps = pr(p);
    function arrow(vec, color, width, label, sub) {
      const tip = pr(add(p, vec));
      ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width;
      drawArrow(ctx, ps.x, ps.y, tip.x, tip.y, 10);
      if (label) {
        // 라벨은 화살표 끝에서 화살표 방향으로 조금 더 나간 곳에
        const dx = tip.x - ps.x, dy = tip.y - ps.y, dl = Math.hypot(dx, dy) || 1;
        ctx.font = 'italic bold 15px serif';
        const lw = ctx.measureText(label).width + (sub ? 8 : 0);
        const lx = tip.x + (dx / dl) * 14 - lw / 2, ly = tip.y + (dy / dl) * 14 + 5;
        ctx.fillText(label, lx, ly);
        if (sub) {
          const w15 = ctx.measureText(label).width;
          ctx.font = 'italic 11px serif';
          ctx.fillText(sub, lx + w15 + 1, ly + 4);
        }
      }
    }
    const L = 0.55; // 기저 화살표 배율 (실제 길이 비율은 유지)
    arrow(mul(eT, L), pal.dir, 2, '∂', 'θ');
    arrow(mul(eF, L), pal.dir, 2, '∂', 'φ');
    const v = add(mul(eT, vt), mul(eF, vf));
    arrow(mul(v, L), pal.curve, 3.2, 'γ′(0)');

    ctx.fillStyle = colors.fg;
    ctx.beginPath(); ctx.arc(ps.x, ps.y, 5, 0, TAU); ctx.fill();
    ctx.strokeStyle = colors.bg; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.font = 'italic 14px serif'; ctx.fillText('p', ps.x - 14, ps.y + 16);

    // 북극 표시
    const np = pr([0, 0, 1]);
    if (np.z >= 0) {
      ctx.fillStyle = colors.fgMuted; ctx.font = '12px sans-serif';
      ctx.fillText('북극', np.x + 6, np.y - 4);
    }
    ctx.fillStyle = colors.fgMuted; ctx.font = '12px sans-serif';
    ctx.fillText('끌어서 회전', 10, h - 10);
  };

  const canvasRef = useCanvas(drawRef);
  usePointer(canvasRef, {
    onDown: (q) => { drag.current = { mx: q.x, my: q.y, ry: rot.current.y, rx: rot.current.x }; },
    onDrag: (q) => {
      const d = drag.current; if (!d) return;
      rot.current = {
        y: d.ry + (q.x - d.mx) * 0.01,
        x: Math.max(-1.4, Math.min(1.4, d.rx + (q.y - d.my) * 0.01)),
      };
    },
    onUp: () => { drag.current = null; },
  });

  // ── 수식 패널 ──
  const C = HEX.coord, D = HEX.dir, G = HEX.curve;
  const eT = dTheta(theta, phi), eF = dPhi(theta, phi);
  const v3 = add(mul(eT, vt), mul(eF, vf));
  const sinT = Math.sin(theta);
  const speed = Math.hypot(...v3);
  const f2 = (x) => (Math.abs(x) < 5e-3 ? 0 : x).toFixed(2);
  const vec3 = (a) => `(${a.map(f2).join(',\\ ')})`;
  const sgn = (x) => (x < 0 ? '-' : '+');

  return (
    <div class="viz-inner">
      <div class="viz-message">
        성분 <Tex>{`(v^{\\theta}, v^{\\phi})`}</Tex>는 그대로 두고 점을 북극 쪽으로 옮겨 보자. <Tex>{`\\textcolor{${D}}{\\partial_\\phi}`}</Tex>가 짧아지므로 같은 성분이 더 느린 속도를 뜻한다. 속도 화살표는 언제나 그 점의 접평면 안에 있다.
      </div>
      <canvas ref={canvasRef} />
      <div class="viz-formula">
        <div>
          <Tex>{`\\textcolor{${G}}{\\gamma'(0)} = ${f2(vt)}\\,\\textcolor{${D}}{\\partial_\\theta} ${sgn(vf)} ${f2(Math.abs(vf))}\\,\\textcolor{${D}}{\\partial_\\phi}`}</Tex>
        </div>
        <div>
          <Tex>{`\\textcolor{${D}}{\\partial_\\theta} = ${vec3(eT)},\\quad |\\textcolor{${D}}{\\partial_\\theta}| = 1`}</Tex>
        </div>
        <div>
          <Tex>{`\\textcolor{${D}}{\\partial_\\phi} = ${vec3(eF)},\\quad |\\textcolor{${D}}{\\partial_\\phi}| = \\sin\\textcolor{${C}}{\\theta} = ${sinT.toFixed(2)}`}</Tex>
        </div>
        <div>
          <Tex>{`\\textcolor{${G}}{\\gamma'(0)} = ${vec3(v3)},\\quad |\\textcolor{${G}}{\\gamma'(0)}| = \\sqrt{(v^\\theta)^2 + \\sin^2\\textcolor{${C}}{\\theta}\\,(v^\\phi)^2} = ${speed.toFixed(2)}`}</Tex>
          <span style={{ color: 'var(--fg-muted)', marginLeft: '0.6em', fontSize: '0.9em' }}>바깥 3차원에서 본 같은 속도</span>
        </div>
      </div>
      <div class="viz-controls">
        <Slider label={<Tex>{`\\textcolor{${C}}{\\theta}\\ \\text{(북극에서 잰 각)}`}</Tex>} min={0.05} max={3.09} step={0.01} value={theta} onChange={setTheta} />
        <Slider label={<Tex>{`\\textcolor{${C}}{\\phi}\\ \\text{(경도)}`}</Tex>} min={0} max={6.28} step={0.01} value={phi} onChange={setPhi} />
        <Slider label={<Tex>{`v^{\\theta}`}</Tex>} min={-1.5} max={1.5} step={0.05} value={vt} onChange={setVt} />
        <Slider label={<Tex>{`v^{\\phi}`}</Tex>} min={-1.5} max={1.5} step={0.05} value={vf} onChange={setVf} />
      </div>
    </div>
  );
}

export function mount(el) { render(<Ch02Viz />, el); }
