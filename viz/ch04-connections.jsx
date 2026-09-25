// 4장 — 극좌표에서 평행이동: 성분은 변하지만 Γ 보정이 정확히 상쇄한다.
// 반지름 r 인 원을 따라 상수 벡터 V 를 옮긴다(평면이므로 화살표는 돌지 않는다).
// 색: V = field, 기저 ∂_r·∂_θ = dir, Γ = conn, 좌표 r·θ = coord, 성분 고정(가짜) = 회색 점선.
import { h, render } from 'preact';
import { useState, useRef, useEffect } from 'preact/hooks';
import { useCanvas, usePointer } from './shared/canvas-utils.jsx';
import { Slider, Toggle } from './shared/controls.jsx';
import { useThemeColors } from './shared/theme.jsx';
import { usePalette, HEX } from './shared/palette.js';
import { Tex } from './shared/tex.jsx';
import { drawArrow } from './shared/math.js';

const TAU = 2 * Math.PI;
const RMAX = 2.2; // 화면에 보이는 반지름 범위

const sgn = (v) => (v >= 0 ? '+' : '-') + Math.abs(v).toFixed(2);

function Ch04Viz() {
  const colors = useThemeColors();
  const pal = usePalette();
  const [r, setR] = useState(1.2);
  const [naive, setNaive] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [view, setView] = useState({ th: 0.6, alpha: 1.0 });
  const st = useRef({ th: 0.6, alpha: 1.0 });
  const pending = useRef(false);

  // 캔버스는 ref 를 읽고, 수식 패널은 프레임당 한 번 갱신
  function update(patch) {
    Object.assign(st.current, patch);
    if (!pending.current) {
      pending.current = true;
      requestAnimationFrame(() => { pending.current = false; setView({ ...st.current }); });
    }
  }

  useEffect(() => {
    if (!playing) return;
    let last = performance.now(), id;
    const tick = (now) => {
      const dt = (now - last) / 1000; last = now;
      update({ th: (st.current.th + dt * 0.6) % TAU });
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [playing]);

  function geom(w, h) {
    const cx = w / 2, cy = h / 2;
    const unit = Math.min(w, h) / (2 * RMAX + 0.4);
    return { cx, cy, unit };
  }

  const drawRef = useRef(null);
  drawRef.current = (ctx, w, h) => {
    const { th, alpha } = st.current;
    const { cx, cy, unit } = geom(w, h);
    const S = (x, y) => [cx + x * unit, cy - y * unit];

    // 극좌표 격자
    ctx.strokeStyle = colors.border; ctx.lineWidth = 1;
    for (let k = 1; k <= 4; k++) { ctx.beginPath(); ctx.arc(cx, cy, k * 0.5 * unit, 0, TAU); ctx.stroke(); }
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * TAU; const [x, y] = S(RMAX * Math.cos(a), RMAX * Math.sin(a));
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke();
    }
    // 경로: 반지름 r 인 원 (θ 좌표선)
    ctx.strokeStyle = pal.coord; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, r * unit, 0, TAU); ctx.stroke();
    // 지나온 호
    ctx.lineWidth = 4; ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.arc(cx, cy, r * unit, 0, -th, true); ctx.stroke();
    ctx.globalAlpha = 1;

    const px = r * Math.cos(th), py = r * Math.sin(th);
    const [sx, sy] = S(px, py);
    const L = 0.75; // 벡터 표시 길이 (world)

    // 좌표 기저: ∂_r 길이 1, ∂_θ 길이 r
    const bs = 0.55;
    ctx.strokeStyle = pal.dir; ctx.fillStyle = pal.dir; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.8;
    const er = S(px + bs * Math.cos(th), py + bs * Math.sin(th));
    const et = S(px - bs * r * Math.sin(th), py + bs * r * Math.cos(th));
    drawArrow(ctx, sx, sy, er[0], er[1], 6);
    drawArrow(ctx, sx, sy, et[0], et[1], 6);
    ctx.globalAlpha = 1;
    ctx.font = 'italic 13px serif';
    ctx.fillText('∂', er[0] + 4, er[1] - 2); ctx.font = 'italic 10px serif'; ctx.fillText('r', er[0] + 11, er[1] + 2);
    ctx.font = 'italic 13px serif';
    ctx.fillText('∂', et[0] + 4, et[1] - 2); ctx.font = 'italic 10px serif'; ctx.fillText('θ', et[0] + 11, et[1] + 2);

    // 성분 고정(가짜 평행이동): 출발점 성분을 그대로 들고 오면 θ 만큼 돌아간다
    if (naive) {
      const a = alpha + th;
      const e = S(px + L * Math.cos(a), py + L * Math.sin(a));
      ctx.strokeStyle = colors.fgMuted; ctx.fillStyle = colors.fgMuted; ctx.lineWidth = 2.5; ctx.setLineDash([6, 4]);
      drawArrow(ctx, sx, sy, e[0], e[1], 9);
      ctx.setLineDash([]);
      if (w >= 520) { ctx.font = '12px sans-serif'; ctx.fillText('성분 고정', e[0] + 6, e[1] + 14); }
    }
    // 진짜 평행이동: 평면에서는 방향 그대로
    const e = S(px + L * Math.cos(alpha), py + L * Math.sin(alpha));
    ctx.strokeStyle = pal.field; ctx.fillStyle = pal.field; ctx.lineWidth = 3.5;
    drawArrow(ctx, sx, sy, e[0], e[1], 11);
    ctx.font = 'bold italic 15px serif';
    ctx.fillText('V', e[0] + 6, e[1] - 4);

    ctx.fillStyle = colors.fg;
    ctx.beginPath(); ctx.arc(sx, sy, 4.5, 0, TAU); ctx.fill();

    // 출발점 표시
    const [ox, oy] = S(r, 0);
    ctx.strokeStyle = colors.fgMuted; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(ox, oy, 5, 0, TAU); ctx.stroke();

    ctx.fillStyle = colors.fgMuted; ctx.font = '12px sans-serif';
    ctx.fillText('끌어서 V 의 방향 바꾸기', 10, h - 10);
  };

  const canvasRef = useCanvas(drawRef);

  usePointer(canvasRef, {
    onDown: (pos) => aim(pos),
    onDrag: (pos) => aim(pos),
  });
  function aim(pos) {
    const c = canvasRef.current;
    const { cx, cy, unit } = geom(c.clientWidth, c.clientHeight);
    const { th } = st.current;
    const px = cx + r * Math.cos(th) * unit, py = cy - r * Math.sin(th) * unit;
    if (Math.hypot(pos.x - px, pos.y - py) < 8) return;
    update({ alpha: Math.atan2(-(pos.y - py), pos.x - px) });
  }

  // ── 수식 패널: 성분의 편미분 + Γ 보정 = 0 ──
  const { th, alpha } = view;
  const d = alpha - th;
  const Vr = Math.cos(d), Vt = Math.sin(d) / r;
  const dVr = Math.sin(d), gVr = -r * Vt;          // ∂V^r/∂θ,  Γ^r_θθ V^θ
  const dVt = -Math.cos(d) / r, gVt = Vr / r;       // ∂V^θ/∂θ,  Γ^θ_θr V^r
  const F = HEX.field, G = HEX.conn, C = HEX.coord;
  const Vr_ = `\\textcolor{${F}}{V}^r`, Vt_ = `\\textcolor{${F}}{V}^\\theta`;
  const th_ = `\\textcolor{${C}}{\\theta}`;

  return (
    <div class="viz-inner">
      <div class="viz-message">
        성분 <Tex>{Vr_}</Tex>, <Tex>{Vt_}</Tex>는 계속 변하지만 <Tex>{`\\textcolor{${G}}{\\Gamma}`}</Tex> 보정 항이 그 변화를 정확히 상쇄해서, 공변미분은 언제나 0이다. 화살표는 실제로 돌지 않았다.
      </div>
      <canvas ref={canvasRef} />
      <div class="viz-formula">
        <div>
          <Tex>{`${th_} = ${(th * 180 / Math.PI).toFixed(0)}^\\circ,\\quad ${Vr_} = ${Vr.toFixed(2)},\\quad ${Vt_} = ${Vt.toFixed(2)}`}</Tex>
        </div>
        <div>
          <Tex>{`\\textcolor{${G}}{\\Gamma}^r_{\\theta\\theta} = -\\textcolor{${C}}{r} = ${(-r).toFixed(2)},\\quad \\textcolor{${G}}{\\Gamma}^\\theta_{\\theta r} = 1/\\textcolor{${C}}{r} = ${(1 / r).toFixed(2)}`}</Tex>
        </div>
        <div>
          <Tex>{`\\displaystyle\\frac{\\partial ${Vr_}}{\\partial ${th_}} + \\textcolor{${G}}{\\Gamma}^r_{\\theta\\theta}${Vt_} = ${dVr.toFixed(2)} ${sgn(gVr)} = ${(dVr + gVr).toFixed(2)}`}</Tex>
        </div>
        <div>
          <Tex>{`\\displaystyle\\frac{\\partial ${Vt_}}{\\partial ${th_}} + \\textcolor{${G}}{\\Gamma}^\\theta_{\\theta r}${Vr_} = ${dVt.toFixed(2)} ${sgn(gVt)} = ${(dVt + gVt).toFixed(2)}`}</Tex>
        </div>
      </div>
      <div class="viz-controls">
        <button class="viz-btn" onClick={() => setPlaying(p => !p)}>{playing ? '⏸ 멈춤' : '▶ 한 바퀴'}</button>
        <Slider label={<Tex>{`\\text{위치 } ${th_}`}</Tex>} min={0} max={360} step={1} value={Math.round(view.th * 180 / Math.PI)}
          onChange={(v) => { setPlaying(false); update({ th: v * Math.PI / 180 }); }} />
        <Slider label={<Tex>{`\\text{반지름 } \\textcolor{${C}}{r}`}</Tex>} min={0.5} max={2} step={0.01} value={r} onChange={setR} />
        <Toggle label="성분 고정 (보정 없음, 회색 점선)" value={naive} onChange={setNaive} />
      </div>
    </div>
  );
}

export function mount(el) { render(<Ch04Viz />, el); }
