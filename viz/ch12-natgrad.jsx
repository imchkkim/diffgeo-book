// 12장 — 정규분포 N(μ, σ²) 를 평균 2, 분산 1인 데이터에 맞추기.
// 왼쪽 (μ, σ) 좌표, 오른쪽 (μ, log σ) 좌표. 같은 손실 L 의 등고선 위에
// 보통 경사(σ 좌표), 보통 경사(log σ 좌표), 자연 경사의 흐름선을 양쪽에 함께 그린다.
// 색: 좌표 = coord, 손실 L = loss, 피셔 계량·자연 경사 = metric (palette.json).
import { h, render } from 'preact';
import { useState, useRef } from 'preact/hooks';
import { useCanvas, usePointer } from './shared/canvas-utils.jsx';
import { useThemeColors } from './shared/theme.jsx';
import { usePalette, HEX } from './shared/palette.js';
import { Tex } from './shared/tex.jsx';

const TAU = 2 * Math.PI;
const M = 2, VAR = 1;                    // 데이터의 평균과 분산
const MU = [-1.5, 3.5];
const SIG = [0.15, 2.6];
const LS = [Math.log(SIG[0]), Math.log(SIG[1])];

const loss = (mu, s) => Math.log(s) + (VAR + (mu - M) ** 2) / (2 * s * s);
// σ 좌표의 그래디언트
const gradSig = (mu, s) => [(mu - M) / (s * s), 1 / s - (VAR + (mu - M) ** 2) / s ** 3];
// log σ 좌표의 그래디언트 (∂L/∂(log σ) = σ ∂L/∂σ)
const gradLog = (mu, s) => { const g = gradSig(mu, s); return [g[0], s * g[1]]; };
// 자연 경사: F = diag(1/σ², 2/σ²) (σ 좌표), F = diag(1/σ², 2) (log σ 좌표)
const natSig = (mu, s) => { const g = gradSig(mu, s); return [s * s * g[0], (s * s / 2) * g[1]]; };
const natLog = (mu, s) => { const g = gradLog(mu, s); return [s * s * g[0], g[1] / 2]; };

// 흐름선: 각자의 좌표에서 정해진 길이만큼씩 방향을 따라 내려간다 (곡선 모양만 비교)
function flow(mu, s, kind) {
  const path = [[mu, s]];
  const H = 0.01;
  let a = mu, b = kind === 'sig' || kind === 'natSig' ? s : Math.log(s);
  for (let i = 0; i < 2500; i++) {
    const sig = kind === 'sig' || kind === 'natSig' ? b : Math.exp(b);
    const d = kind === 'sig' ? gradSig(a, sig) : kind === 'log' ? gradLog(a, sig)
      : kind === 'natSig' ? natSig(a, sig) : natLog(a, sig);
    const n = Math.hypot(d[0], d[1]);
    if (n < 1e-6) break;
    a -= H * d[0] / n; b -= H * d[1] / n;
    const s2 = kind === 'sig' || kind === 'natSig' ? b : Math.exp(b);
    if (s2 < 0.02 || a < MU[0] - 1 || a > MU[1] + 1 || s2 > 6) break;
    path.push([a, s2]);
    if (Math.hypot(a - M, s2 - 1) < 0.01) break;
  }
  return path;
}

function panels(w, h) {
  const gap = 18, top = 26, bottom = 30;
  const pw = (w - gap * 3) / 2, ph = h - top - bottom;
  return [
    { x: gap, y: top, w: pw, h: ph, log: false },
    { x: gap * 2 + pw, y: top, w: pw, h: ph, log: true },
  ];
}
const yOf = (P, s) => P.log ? (Math.log(s) - LS[0]) / (LS[1] - LS[0]) : (s - SIG[0]) / (SIG[1] - SIG[0]);
const toScr = (P, mu, s) => [P.x + (mu - MU[0]) / (MU[1] - MU[0]) * P.w, P.y + P.h - yOf(P, s) * P.h];
function fromScr(P, x, y) {
  const mu = MU[0] + (x - P.x) / P.w * (MU[1] - MU[0]);
  const t = (P.y + P.h - y) / P.h;
  const s = P.log ? Math.exp(LS[0] + t * (LS[1] - LS[0])) : SIG[0] + t * (SIG[1] - SIG[0]);
  return [Math.min(MU[1], Math.max(MU[0], mu)), Math.min(SIG[1], Math.max(SIG[0], s))];
}

function Ch12Viz() {
  const colors = useThemeColors();
  const pal = usePalette();
  const start = useRef([-1, 2.2]);
  const [read, setRead] = useState(start.current);
  const pending = useRef(false);
  const cache = useRef({ key: '', img: null });

  function setStart(v) {
    start.current = v;
    if (pending.current) return;
    pending.current = true;
    requestAnimationFrame(() => { pending.current = false; setRead(start.current); });
  }

  // 등고선은 크기·테마가 바뀔 때만 다시 그린다
  function contours(ctx, w, h, Ps) {
    const dpr = window.devicePixelRatio || 1;
    const key = [w, h, dpr, colors.fgMuted, colors.bg].join('|');
    if (cache.current.key !== key) {
      const off = document.createElement('canvas');
      off.width = w * dpr; off.height = h * dpr;
      const oc = off.getContext('2d');
      oc.scale(dpr, dpr);
      const levels = [];
      for (let k = 0; k < 16; k++) levels.push(0.42 + 0.14 * k * k / 3);
      for (const P of Ps) {
        const step = 2;
        for (let px = 0; px < P.w; px += step) {
          for (let py = 0; py < P.h; py += step) {
            const [mu, s] = fromScr(P, P.x + px + step / 2, P.y + py + step / 2);
            const L = loss(mu, s);
            let band = 0;
            while (band < levels.length && L > levels[band]) band++;
            if (band % 2 === 1) {
              oc.fillStyle = colors.fgMuted; oc.globalAlpha = 0.07;
              oc.fillRect(P.x + px, P.y + py, step, step);
            }
          }
        }
      }
      oc.globalAlpha = 1;
      cache.current = { key, img: off };
    }
    ctx.drawImage(cache.current.img, 0, 0, w, h);
  }

  const drawRef = useRef(null);
  drawRef.current = (ctx, w, h) => {
    const Ps = panels(w, h);
    for (const P of Ps) { ctx.fillStyle = colors.bg; ctx.fillRect(P.x, P.y, P.w, P.h); }
    contours(ctx, w, h, Ps);
    const [mu0, s0] = start.current;
    const paths = {
      sig: flow(mu0, s0, 'sig'), log: flow(mu0, s0, 'log'),
      natSig: flow(mu0, s0, 'natSig'), natLog: flow(mu0, s0, 'natLog'),
    };

    for (const P of Ps) {
      ctx.save();
      ctx.beginPath(); ctx.rect(P.x, P.y, P.w, P.h); ctx.clip();
      function line(path, style, width, dash) {
        ctx.strokeStyle = style; ctx.lineWidth = width; ctx.setLineDash(dash || []);
        ctx.beginPath();
        path.forEach(([m, s], i) => { const [x, y] = toScr(P, m, s); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
        ctx.stroke(); ctx.setLineDash([]);
      }
      line(paths.sig, colors.fg, 1.6);
      line(paths.log, colors.fgMuted, 1.8, [6, 4]);
      line(paths.natSig, pal.metric, 4);
      line(paths.natLog, colors.bg, 1.2, [2, 4]); // log σ 좌표로 계산한 자연 경사: 굵은 선 위의 흰 점선

      // 최솟값과 출발점
      const [xm, ym] = toScr(P, M, 1);
      ctx.fillStyle = pal.loss;
      ctx.beginPath(); ctx.arc(xm, ym, 5, 0, TAU); ctx.fill();
      const [xs, ys] = toScr(P, mu0, s0);
      ctx.fillStyle = colors.fg;
      ctx.beginPath(); ctx.arc(xs, ys, 6, 0, TAU); ctx.fill();
      ctx.strokeStyle = colors.bg; ctx.lineWidth = 2; ctx.stroke();
      ctx.restore();

      ctx.strokeStyle = colors.border; ctx.lineWidth = 1;
      ctx.strokeRect(P.x, P.y, P.w, P.h);
      // 축 이름
      ctx.fillStyle = pal.coord; ctx.font = 'italic 14px serif';
      ctx.textAlign = 'center';
      ctx.fillText('μ', P.x + P.w / 2, P.y + P.h + 20);
      ctx.textAlign = 'left';
      ctx.fillText(P.log ? 'log σ' : 'σ', P.x + 4, P.y - 8);
      ctx.fillStyle = colors.fgMuted; ctx.font = '12px sans-serif';
      ctx.fillText(P.log ? '좌표 (μ, log σ)' : '좌표 (μ, σ)', P.x + 44, P.y - 8);
      // 눈금
      ctx.font = '10px sans-serif';
      for (const s of [0.25, 0.5, 1, 2]) {
        const [, y] = toScr(P, MU[0], s);
        ctx.fillText(String(s), P.x + 3, y + 3);
        ctx.strokeStyle = colors.border; ctx.beginPath(); ctx.moveTo(P.x + 22, y); ctx.lineTo(P.x + 30, y); ctx.stroke();
      }
    }
  };

  const canvasRef = useCanvas(drawRef);

  function pick(pos) {
    const cv = canvasRef.current;
    const Ps = panels(cv.clientWidth, cv.clientHeight);
    const P = Ps.find(P => pos.x >= P.x && pos.x <= P.x + P.w && pos.y >= P.y && pos.y <= P.y + P.h);
    if (P) setStart(fromScr(P, pos.x, pos.y));
  }
  usePointer(canvasRef, { onDown: pick, onDrag: pick });

  // ── 수식 패널 ──
  const C = HEX.coord, Lc = HEX.loss, G = HEX.metric;
  const [mu, s] = read;
  const g = gradSig(mu, s), gl = gradLog(mu, s), n = natSig(mu, s), nl = natLog(mu, s);
  const f = v => v.toFixed(2);
  const pair = v => `(${f(v[0])},\\ ${f(v[1])})`;
  const legend = (style, text) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35em', marginRight: '1em' }}>
      <span style={{ display: 'inline-block', width: '22px', height: 0, borderTop: style }} />{text}
    </span>
  );

  return (
    <div class="viz-inner">
      <div class="viz-message">
        보통 경사하강은 좌표를 <Tex>{`\\textcolor{${C}}{\\sigma}`}</Tex>에서 <Tex>{`\\log\\textcolor{${C}}{\\sigma}`}</Tex>로 바꾸면 다른 길로 가지만, 자연 경사의 길은 어느 좌표로 계산해도 같은 길이다.
      </div>
      <canvas ref={canvasRef} />
      <div class="viz-formula">
        <div>
          <Tex>{`(\\textcolor{${C}}{\\mu}, \\textcolor{${C}}{\\sigma}) = (${f(mu)},\\ ${f(s)}),\\quad \\textcolor{${Lc}}{L} = ${loss(mu, s).toFixed(3)}`}</Tex>
        </div>
        <div>
          <Tex>{`\\textcolor{${C}}{\\sigma}\\text{ 좌표: }\\ \\nabla\\textcolor{${Lc}}{L} = ${pair(g)},\\ \\ \\textcolor{${G}}{F} = \\mathrm{diag}(${f(1 / (s * s))},\\ ${f(2 / (s * s))})`}</Tex>
          <span style={{ marginLeft: '1em' }}><Tex>{`\\textcolor{${G}}{F}^{-1}\\nabla\\textcolor{${Lc}}{L} = ${pair(n)}`}</Tex></span>
        </div>
        <div>
          <Tex>{`\\log\\textcolor{${C}}{\\sigma}\\text{ 좌표: }\\ \\nabla\\textcolor{${Lc}}{L} = ${pair(gl)},\\ \\ \\textcolor{${G}}{F} = \\mathrm{diag}(${f(1 / (s * s))},\\ 2)`}</Tex>
          <span style={{ marginLeft: '1em' }}><Tex>{`\\textcolor{${G}}{F}^{-1}\\nabla\\textcolor{${Lc}}{L} = ${pair(nl)}`}</Tex></span>
        </div>
        <div>
          <Tex>{`\\text{자연 경사를 옮기면: } ${f(n[1])} \\div \\textcolor{${C}}{\\sigma} = ${f(n[1] / s)} = ${f(nl[1])}\\ \\ (\\text{일치})`}</Tex>
        </div>
        <div>
          <Tex>{`\\text{보통 경사를 옮기면: } ${f(g[1])} \\div \\textcolor{${C}}{\\sigma} = ${f(g[1] / s)} ${Math.abs(g[1] / s - gl[1]) < 0.005 ? '= ' + f(gl[1]) + '\\ \\ (\\textcolor{' + C + '}{\\sigma} = 1\\text{ 에서만 우연히 같음})' : '\\neq ' + f(gl[1]) + '\\ \\ (\\text{불일치})'}`}</Tex>
        </div>
      </div>
      <div class="viz-controls">
        <button class="viz-btn" onClick={() => setStart([0, 0.5])}>따라 계산해 보기의 점 (0, 0.5)</button>
        <button class="viz-btn" onClick={() => setStart([-1, 2.2])}>(−1, 2.2)</button>
        <button class="viz-btn" onClick={() => setStart([3.3, 0.25])}>(3.3, 0.25)</button>
        <span style={{ fontSize: '0.85em', color: 'var(--fg-muted)' }}>
          {legend('1.6px solid var(--fg)', <span><Tex>{`\\textcolor{${C}}{\\sigma}`}</Tex> 좌표의 보통 경사</span>)}
          {legend('2px dashed var(--fg-muted)', <span><Tex>{`\\log\\textcolor{${C}}{\\sigma}`}</Tex> 좌표의 보통 경사</span>)}
          {legend(`4px solid ${pal.metric}`, '자연 경사 (두 좌표 모두)')}
          · 평면을 눌러 출발점 옮기기 · 점 = 최솟값 (2, 1)
        </span>
      </div>
    </div>
  );
}

export function mount(el) { render(<Ch12Viz />, el); }
