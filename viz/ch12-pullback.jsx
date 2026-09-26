// 12장 풀백 — 결과 공간의 작은 원(자)을 번역표 J 로 다이얼 공간에 끌어오면 타원이 된다.
// 극좌표: G = diag(1, r²), 원점 쪽으로 갈수록 각도 방향으로 길어지는 타원.
// 소프트맥스(로짓 두 개): F = p(1-p)[[1,-1],[-1,1]], 행렬식 0 → 끝없는 띠(길이 0 방향 (1,1)).
// 색: 좌표 = coord, 계량(자) = metric, 번역표 J = aux4, 함수 f = aux2, 확률 p = dist, ε = eps (palette.json).
import { h, render } from 'preact';
import { useState, useRef } from 'preact/hooks';
import { useCanvas, usePointer } from './shared/canvas-utils.jsx';
import { useThemeColors } from './shared/theme.jsx';
import { usePalette, HEX } from './shared/palette.js';
import { Tex } from './shared/tex.jsx';

const TAU = 2 * Math.PI;
const EPS = { polar: 0.15, softmax: 0.3 };
const R_MAX = 3, XY = 3.2, TH = 3.2;       // 극좌표 다이얼 범위, 평면 범위, 로짓 범위
const sigm = t => 1 / (1 + Math.exp(-t));

function panels(w, h) {
  const gap = 18, top = 26, bottom = 30;
  const pw = (w - gap * 3) / 2, ph = h - top - bottom;
  return [{ x: gap, y: top, w: pw, h: ph, side: 'dial' }, { x: gap * 2 + pw, y: top, w: pw, h: ph, side: 'out' }];
}

// 좌표 ↔ 화면. 다이얼(극좌표): 가로 r ∈ [0, 3], 세로 θ ∈ [0, 2π]. 나머지는 정사각 비율.
function sq(P, lim) {
  const s = Math.min(P.w, P.h) / (2 * lim);
  return { s, cx: P.x + P.w / 2, cy: P.y + P.h / 2 };
}
function dialToScr(P, mode, a, b) {
  if (mode === 'polar') return [P.x + a / R_MAX * P.w, P.y + P.h - b / TAU * P.h];
  const { s, cx, cy } = sq(P, TH);
  return [cx + a * s, cy - b * s];
}
function dialFromScr(P, mode, x, y) {
  if (mode === 'polar') {
    const r = Math.min(R_MAX - 0.05, Math.max(0.08, (x - P.x) / P.w * R_MAX));
    const th = Math.min(TAU, Math.max(0, (P.y + P.h - y) / P.h * TAU));
    return [r, th];
  }
  const { s, cx, cy } = sq(P, TH);
  const cl = v => Math.min(TH, Math.max(-TH, v));
  return [cl((x - cx) / s), cl((cy - y) / s)];
}

function Ch12Pullback() {
  const colors = useThemeColors();
  const pal = usePalette();
  const [mode, setModeState] = useState('polar');
  const modeRef = useRef('polar');
  const pt = useRef([1.2, 1.0]);
  const [read, setRead] = useState(pt.current);
  const pending = useRef(false);

  function setPt(v) {
    pt.current = v;
    if (pending.current) return;
    pending.current = true;
    requestAnimationFrame(() => { pending.current = false; setRead(pt.current.slice()); });
  }
  function setMode(m) {
    modeRef.current = m;
    setModeState(m);
    setPt(m === 'polar' ? [1.2, 1.0] : [0.8, -0.4]);
  }

  const drawRef = useRef(null);
  drawRef.current = (ctx, w, h) => {
    const mode = modeRef.current;
    const Ps = panels(w, h);
    const [a, b] = pt.current;
    const eps = EPS[mode];
    for (const P of Ps) { ctx.fillStyle = colors.bg; ctx.fillRect(P.x, P.y, P.w, P.h); }

    // 타원 { v : vᵀ G v ≤ ε² } 을 다이얼 화면에 그린다 (G 대각이면 축 방향 반지름 ε/√G)
    function ellipse(P, ra, rb, fill, stroke, lw) {
      const [x, y] = dialToScr(P, mode, a, b);
      ctx.beginPath();
      for (let k = 0; k <= 64; k++) {
        const t = k / 64 * TAU;
        const [px, py] = dialToScr(P, mode, a + ra * Math.cos(t), b + rb * Math.sin(t));
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
      return [x, y];
    }

    const [D, O] = Ps;
    // ── 다이얼 공간 ──
    ctx.save(); ctx.beginPath(); ctx.rect(D.x, D.y, D.w, D.h); ctx.clip();
    if (mode === 'polar') {
      // 격자 위의 끌어온 타원들 (옅게)
      ctx.globalAlpha = 0.35;
      for (let r = 0.4; r < R_MAX; r += 0.5) {
        for (let th = TAU / 16; th < TAU; th += TAU / 8) {
          ctx.beginPath();
          for (let k = 0; k <= 48; k++) {
            const t = k / 48 * TAU;
            const [px, py] = dialToScr(D, mode, r + eps * Math.cos(t), th + eps / r * Math.sin(t));
            if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
          ctx.strokeStyle = pal.metric; ctx.lineWidth = 1; ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      ctx.globalAlpha = 0.25; ellipse(D, eps, eps / a, pal.metric); ctx.globalAlpha = 1;
      ellipse(D, eps, eps / a, null, pal.metric, 2.5);
    } else {
      // p 가 같은 선 (θ¹ − θ² = 상수) 을 옅게
      ctx.strokeStyle = colors.border; ctx.lineWidth = 1;
      for (const pv of (D.w < 260 ? [0.25, 0.5, 0.75] : [0.1, 0.25, 0.5, 0.75, 0.9])) {
        const c = Math.log(pv / (1 - pv));
        const [x1, y1] = dialToScr(D, mode, -2 * TH, -2 * TH - c);
        const [x2, y2] = dialToScr(D, mode, 2 * TH, 2 * TH - c);
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        // 이름표는 선이 패널 위쪽이나 오른쪽 가장자리를 만나는 곳에
        const u = Math.min(TH - 0.3, TH - 0.3 + c);
        const [lx, ly] = dialToScr(D, mode, u, u - c);
        ctx.fillStyle = colors.fgMuted; ctx.font = '10px sans-serif'; ctx.fillText('p=' + pv, lx - 34, ly + 12);
      }
      // 띠: |v¹ − v²| ≤ ε / √(p(1−p))
      const p = sigm(a - b), half = eps / Math.sqrt(p * (1 - p));
      const L = 3 * TH;
      // 띠의 가장자리: (a,b) + s(1,1) ± (half/2)(1,−1)
      const edge = sgn => [[-L, -L], [L, L]].map(([u, v]) => dialToScr(D, mode, a + u + sgn * half / 2, b + v - sgn * half / 2));
      const e1 = edge(1), e2 = edge(-1);
      ctx.beginPath(); ctx.moveTo(...e1[0]); ctx.lineTo(...e1[1]); ctx.lineTo(...e2[1]); ctx.lineTo(...e2[0]); ctx.closePath();
      ctx.globalAlpha = 0.22; ctx.fillStyle = pal.metric; ctx.fill(); ctx.globalAlpha = 1;
      ctx.strokeStyle = pal.metric; ctx.lineWidth = 2.5;
      for (const e of [e1, e2]) { ctx.beginPath(); ctx.moveTo(...e[0]); ctx.lineTo(...e[1]); ctx.stroke(); }
      // 길이 0 방향 화살표 (1,1)
      const [x0, y0] = dialToScr(D, mode, a, b);
      const [x1, y1] = dialToScr(D, mode, a + 1.1, b + 1.1);
      ctx.strokeStyle = pal.dir; ctx.fillStyle = pal.dir; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      const ang = Math.atan2(y1 - y0, x1 - x0);
      ctx.beginPath(); ctx.moveTo(x1, y1);
      ctx.lineTo(x1 - 9 * Math.cos(ang - 0.4), y1 - 9 * Math.sin(ang - 0.4));
      ctx.lineTo(x1 - 9 * Math.cos(ang + 0.4), y1 - 9 * Math.sin(ang + 0.4)); ctx.fill();
      ctx.font = '11px sans-serif'; ctx.textAlign = 'right'; ctx.fillText('길이 0 방향 (1, 1)', x0 - 8, y0 + 16); ctx.textAlign = 'left';
    }
    const [xd, yd] = dialToScr(D, mode, a, b);
    ctx.fillStyle = colors.fg; ctx.beginPath(); ctx.arc(xd, yd, 5, 0, TAU); ctx.fill();
    ctx.strokeStyle = colors.bg; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();

    // ── 결과 공간 ──
    ctx.save(); ctx.beginPath(); ctx.rect(O.x, O.y, O.w, O.h); ctx.clip();
    if (mode === 'polar') {
      const { s, cx, cy } = sq(O, XY);
      ctx.strokeStyle = colors.border; ctx.lineWidth = 1;
      for (let r = 0.5; r < XY * 1.5; r += 0.5) { ctx.beginPath(); ctx.arc(cx, cy, r * s, 0, TAU); ctx.stroke(); }
      for (let k = 0; k < 8; k++) {
        const t = k * TAU / 8;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + 2 * XY * s * Math.cos(t), cy - 2 * XY * s * Math.sin(t)); ctx.stroke();
      }
      const x = cx + a * Math.cos(b) * s, y = cy - a * Math.sin(b) * s;
      // 저쪽 자: 반지름 ε 원
      ctx.beginPath(); ctx.arc(x, y, eps * s, 0, TAU);
      ctx.globalAlpha = 0.25; ctx.fillStyle = pal.metric; ctx.fill(); ctx.globalAlpha = 1;
      ctx.strokeStyle = pal.metric; ctx.lineWidth = 2.5; ctx.stroke();
      // 번역표의 두 칸: r 한 칸(0.5), θ 한 칸(0.5 rad) 을 보낸 화살표
      const arrow = (dx, dy, label) => {
        const x1 = x + dx * s, y1 = y - dy * s;
        ctx.strokeStyle = pal.aux4; ctx.fillStyle = pal.aux4; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x1, y1); ctx.stroke();
        const ang = Math.atan2(y1 - y, x1 - x);
        ctx.beginPath(); ctx.moveTo(x1, y1);
        ctx.lineTo(x1 - 8 * Math.cos(ang - 0.4), y1 - 8 * Math.sin(ang - 0.4));
        ctx.lineTo(x1 - 8 * Math.cos(ang + 0.4), y1 - 8 * Math.sin(ang + 0.4)); ctx.fill();
        ctx.font = 'italic 12px serif'; ctx.textAlign = 'center';
        ctx.fillText(label, x1 + 14 * Math.cos(ang), y1 + 14 * Math.sin(ang) + 4); ctx.textAlign = 'left';
      };
      arrow(0.5 * Math.cos(b), 0.5 * Math.sin(b), 'r +0.5');
      arrow(-0.5 * a * Math.sin(b), 0.5 * a * Math.cos(b), 'θ +0.5');
      ctx.fillStyle = colors.fg; ctx.beginPath(); ctx.arc(x, y, 5, 0, TAU); ctx.fill();
      ctx.strokeStyle = colors.bg; ctx.lineWidth = 2; ctx.stroke();
    } else {
      // 결과 공간은 확률 p 한 개의 수: 선분 [0, 1]
      const y = O.y + O.h / 2, x0 = O.x + 24, x1 = O.x + O.w - 24;
      const X = p => x0 + p * (x1 - x0);
      ctx.strokeStyle = colors.fgMuted; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
      ctx.fillStyle = colors.fgMuted; ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
      for (const t of [0, 0.25, 0.5, 0.75, 1]) {
        ctx.beginPath(); ctx.moveTo(X(t), y - 5); ctx.lineTo(X(t), y + 5); ctx.stroke();
        ctx.fillText(String(t), X(t), y + 20);
      }
      const p = sigm(a - b), hw = eps * Math.sqrt(p * (1 - p));
      ctx.globalAlpha = 0.3; ctx.fillStyle = pal.metric;
      ctx.fillRect(X(p - hw), y - 12, X(p + hw) - X(p - hw), 24); ctx.globalAlpha = 1;
      ctx.strokeStyle = pal.metric; ctx.lineWidth = 2.5; ctx.strokeRect(X(p - hw), y - 12, X(p + hw) - X(p - hw), 24);
      ctx.fillStyle = pal.dist; ctx.beginPath(); ctx.arc(X(p), y, 6, 0, TAU); ctx.fill();
      ctx.strokeStyle = colors.bg; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = colors.fgMuted; ctx.fillText(O.w < 260 ? '확률 p 하나' : '결과 공간은 수 하나: 첫 결과의 확률 p', (x0 + x1) / 2, y - 40);
      ctx.textAlign = 'left';
    }
    ctx.restore();

    // 테두리와 축 이름
    for (const P of Ps) { ctx.strokeStyle = colors.border; ctx.lineWidth = 1; ctx.strokeRect(P.x, P.y, P.w, P.h); }
    ctx.font = 'italic 14px serif'; ctx.fillStyle = pal.coord; ctx.textAlign = 'center';
    if (mode === 'polar') {
      ctx.fillText('r', D.x + D.w / 2, D.y + D.h + 20);
      ctx.textAlign = 'left'; ctx.fillText('θ', D.x + 4, D.y - 8);
      ctx.fillStyle = pal.coord; ctx.textAlign = 'center';
      ctx.fillText('x', O.x + O.w / 2, O.y + O.h + 20);
      ctx.textAlign = 'left'; ctx.fillText('y', O.x + 4, O.y - 8);
    } else {
      ctx.fillText('θ¹', D.x + D.w / 2, D.y + D.h + 20);
      ctx.textAlign = 'left'; ctx.fillText('θ²', D.x + 4, D.y - 8);
      ctx.fillStyle = pal.dist; ctx.textAlign = 'center'; ctx.fillText('p', O.x + O.w / 2, O.y + O.h + 20);
    }
    ctx.textAlign = 'left'; ctx.fillStyle = colors.fgMuted; ctx.font = '12px sans-serif';
    ctx.fillText('다이얼 공간 (끌어온 자)', D.x + 24, D.y - 8);
    ctx.fillText('결과 공간 (저쪽 자)', O.x + 24, O.y - 8);
  };

  const canvasRef = useCanvas(drawRef);

  function pick(pos) {
    const cv = canvasRef.current;
    const [D, O] = panels(cv.clientWidth, cv.clientHeight);
    const mode = modeRef.current;
    const inP = P => pos.x >= P.x && pos.x <= P.x + P.w && pos.y >= P.y && pos.y <= P.y + P.h;
    if (inP(D)) setPt(dialFromScr(D, mode, pos.x, pos.y));
    else if (inP(O)) {
      if (mode === 'polar') {
        const { s, cx, cy } = sq(O, XY);
        const X = (pos.x - cx) / s, Y = (cy - pos.y) / s;
        let th = Math.atan2(Y, X); if (th < 0) th += TAU;
        setPt([Math.min(R_MAX - 0.05, Math.max(0.08, Math.hypot(X, Y))), th]);
      } else {
        const x0 = O.x + 24, x1 = O.x + O.w - 24;
        const p = Math.min(0.97, Math.max(0.03, (pos.x - x0) / (x1 - x0)));
        const [a, b] = pt.current, m = (a + b) / 2, d = Math.log(p / (1 - p));
        setPt([m + d / 2, m - d / 2]);
      }
    }
  }
  usePointer(canvasRef, { onDown: pick, onDrag: pick });

  // ── 수식 패널 ──
  const C = HEX.coord, G = HEX.metric, Jc = HEX.aux4, Pc = HEX.dist, Ec = HEX.eps;
  const f2 = v => (Math.abs(v) < 0.005 ? 0 : v).toFixed(2);
  const [a, b] = read;
  let rows;
  if (mode === 'polar') {
    const c = Math.cos(b), s = Math.sin(b);
    rows = [
      <Tex>{`(\\textcolor{${C}}{r}, \\textcolor{${C}}{\\theta}) = (${f2(a)},\\ ${f2(b)}),\\qquad \\textcolor{${Jc}}{J} = \\begin{pmatrix} ${f2(c)} & ${f2(-a * s)} \\\\ ${f2(s)} & ${f2(a * c)} \\end{pmatrix}`}</Tex>,
      <Tex>{`\\textcolor{${G}}{G} = \\textcolor{${Jc}}{J}^T\\textcolor{${Jc}}{J} = \\mathrm{diag}(1,\\ \\textcolor{${C}}{r}^2) = \\mathrm{diag}(1,\\ ${f2(a * a)})`}</Tex>,
      <span>각도 다이얼 0.01 → 실제 이동 <Tex>{`0.01 \\times \\textcolor{${C}}{r} = ${(0.01 * a).toFixed(4)}`}</Tex>, 타원의 <Tex>{`\\textcolor{${C}}{\\theta}`}</Tex> 방향 반지름 <Tex>{`\\textcolor{${Ec}}{\\epsilon}/\\textcolor{${C}}{r} = ${f2(EPS.polar / a)}`}</Tex></span>,
    ];
  } else {
    const p = sigm(a - b), q = p * (1 - p);
    rows = [
      <Tex>{`(\\textcolor{${C}}{\\theta}^1, \\textcolor{${C}}{\\theta}^2) = (${f2(a)},\\ ${f2(b)}),\\qquad \\textcolor{${Pc}}{p} = ${p.toFixed(3)},\\qquad \\textcolor{${Jc}}{J} = ${q.toFixed(3)}\\,(1,\\ -1)`}</Tex>,
      <Tex>{`\\textcolor{${G}}{F} = \\textcolor{${Jc}}{J}^T\\textcolor{${G}}{g}\\textcolor{${Jc}}{J} = \\textcolor{${Pc}}{p}(1-\\textcolor{${Pc}}{p})\\begin{pmatrix} 1 & -1 \\\\ -1 & 1 \\end{pmatrix} = \\begin{pmatrix} ${q.toFixed(3)} & ${(-q).toFixed(3)} \\\\ ${(-q).toFixed(3)} & ${q.toFixed(3)} \\end{pmatrix},\\quad \\det\\textcolor{${G}}{F} = 0`}</Tex>,
      <span><Tex>{`\\textcolor{${G}}{F}\\,(1, 1)^T = (0, 0)^T`}</Tex> : 두 로짓에 같은 수를 더하면 <Tex>{`\\textcolor{${Pc}}{p}`}</Tex>가 그대로라 길이 0</span>,
    ];
  }

  return (
    <div class="viz-inner">
      <div class="viz-message">
        오른쪽의 작은 원은 저쪽 자로 잰 길이 <Tex>{`\\textcolor{${Ec}}{\\epsilon}`}</Tex>인 변화들이다. 번역표 <Tex>{`\\textcolor{${Jc}}{J}`}</Tex>로 끌어오면 왼쪽에서는 찌그러진 타원이 되고, 번역표가 납작한 방향이 있으면 끝없는 띠가 된다.
      </div>
      <canvas ref={canvasRef} />
      <div class="viz-formula">
        {rows.map(r => <div>{r}</div>)}
      </div>
      <div class="viz-controls">
        <button class={'viz-btn' + (mode === 'polar' ? ' active' : '')} onClick={() => setMode('polar')}>극좌표 → 평면</button>
        <button class={'viz-btn' + (mode === 'softmax' ? ' active' : '')} onClick={() => setMode('softmax')}>로짓 두 개 → 확률</button>
        {mode === 'polar'
          ? <button class="viz-btn" onClick={() => setPt([0.2, 1.0])}>원점 가까이 (r = 0.2)</button>
          : <button class="viz-btn" onClick={() => setPt([0, 0])}>문제 6의 점 (0, 0)</button>}
        <span style={{ fontSize: '0.85em', color: 'var(--fg-muted)' }}>
          {mode === 'polar' ? '· 보라 화살표 = 다이얼 0.5 칸을 번역표로 보낸 것 ' : ''}· 어느 쪽 평면이든 눌러 끌면 점이 움직인다
        </span>
      </div>
    </div>
  );
}

export function mount(el) { render(<Ch12Pullback />, el); }
