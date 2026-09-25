// 6장 — 대원(측지선) vs 등각항로(메르카토르 위 직선).
// 경로 위 한 점에서 측지선 방정식의 두 항을 수치로 계산해, 대원에서는 합이 0, 등각항로에서는 0이 아님을 보인다.
// 색: 곡선 γ(대원) = curve, 크리스토펠 항 = conn, 등각항로 = 회색 점선 (palette.json).
import { render } from 'preact';
import { useState, useRef, useMemo } from 'preact/hooks';
import { useCanvas, usePointer } from './shared/canvas-utils.jsx';
import { Slider } from './shared/controls.jsx';
import { useThemeColors } from './shared/theme.jsx';
import { usePalette, HEX } from './shared/palette.js';
import { Tex } from './shared/tex.jsx';
import { clamp, project3D } from './shared/math.js';

const TAU = 2 * Math.PI;
const DEG = Math.PI / 180;
const EARTH = 6371;
const MAX_LAT = 82 * DEG;
const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + lat / 2));
const invMercY = (y) => 2 * Math.atan(Math.exp(y)) - Math.PI / 2;
const ll = (lat, lon) => [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)];
const toLatLon = ([x, y, z]) => [Math.atan2(z, Math.hypot(x, y)), Math.atan2(y, x)];

const CITIES = [
  { name: '서울', lat: 37.5 * DEG, lon: 127 * DEG },
  { name: '뉴욕', lat: 40.7 * DEG, lon: -74 * DEG },
  { name: '상파울루', lat: -23.5 * DEG, lon: -46.6 * DEG },
  { name: '런던', lat: 51.5 * DEG, lon: -0.1 * DEG },
  { name: '시드니', lat: -33.9 * DEG, lon: 151.2 * DEG },
];

// 호의 길이 s(반지름 1)로 매개화한 두 경로. 각각 s → 단위벡터.
function makePaths(a, b) {
  const A = ll(a.lat, a.lon), B = ll(b.lat, b.lon);
  const d = Math.max(-1, Math.min(1, A[0] * B[0] + A[1] * B[1] + A[2] * B[2]));
  const w = Math.acos(d);
  const Q = B.map((v, i) => (v - d * A[i]) / Math.sin(w));
  const gc = (s) => A.map((v, i) => Math.cos(s) * v + Math.sin(s) * Q[i]);

  // 등각항로: 메르카토르에서 직선 (경도 차는 그대로, 날짜변경선 넘기지 않음)
  const dLon = b.lon - a.lon, dY = mercY(b.lat) - mercY(a.lat);
  const al = Math.atan2(dLon, dY); // 북쪽에서 잰 방위각
  let rh, rhLen;
  if (Math.abs(Math.cos(al)) > 1e-6) {
    rhLen = (b.lat - a.lat) / Math.cos(al);
    rh = (s) => { const lat = a.lat + s * Math.cos(al); return ll(lat, a.lon + Math.tan(al) * (mercY(lat) - mercY(a.lat))); };
  } else {
    rhLen = Math.abs(dLon) * Math.cos(a.lat);
    rh = (s) => ll(a.lat, a.lon + Math.sign(dLon) * s / Math.cos(a.lat));
  }
  return { gc, gcLen: w, rh, rhLen };
}

// 점 s 에서 (θ, φ) 의 1·2계 도함수를 중앙차분으로 구하고 측지선 방정식의 항을 계산
function geodesicTerms(f, s) {
  const hh = 1e-4;
  const tp = (u) => { const [x, y, z] = f(u); return [Math.acos(Math.max(-1, Math.min(1, z))), Math.atan2(y, x)]; };
  const [t0, p0] = tp(s - hh), [t1, p1] = tp(s), [t2, p2] = tp(s + hh);
  const wrap = (x) => Math.atan2(Math.sin(x), Math.cos(x));
  const dp1 = wrap(p1 - p0), dp2 = wrap(p2 - p1);
  const td = (t2 - t0) / (2 * hh), tdd = (t2 - 2 * t1 + t0) / (hh * hh);
  const pd = (dp1 + dp2) / (2 * hh), pdd = (dp2 - dp1) / (hh * hh);
  const gT = -Math.sin(t1) * Math.cos(t1) * pd * pd;          // Γ^θ_φφ (φ̇)²
  const gP = 2 * (Math.cos(t1) / Math.sin(t1)) * td * pd;     // 2Γ^φ_θφ θ̇ φ̇
  return { tdd, gT, sT: tdd + gT, pdd, gP, sP: pdd + gP };
}

function Ch06Viz() {
  const colors = useThemeColors();
  const pal = usePalette();
  const [fromIdx, setFromIdx] = useState(0);
  const [toIdx, setToIdx] = useState(1);
  const [frac, setFrac] = useState(0.5);
  const rot = useRef({ y: 2.2, x: 0.5 });
  const drag = useRef(null);

  const from = CITIES[fromIdx], to = CITIES[toIdx];
  const P = useMemo(() => makePaths(from, to), [fromIdx, toIdx]);
  const same = fromIdx === toIdx;
  const terms = useMemo(() => same ? null : {
    gc: geodesicTerms(P.gc, frac * P.gcLen),
    rh: geodesicTerms(P.rh, frac * P.rhLen),
  }, [P, frac, same]);

  const drawRef = useRef(null);
  drawRef.current = (ctx, w, h) => {
    const mid = w * 0.5;
    const N = 160;
    const gcPts = same ? [] : Array.from({ length: N + 1 }, (_, i) => toLatLon(P.gc((i / N) * P.gcLen)));
    const rhPts = same ? [] : Array.from({ length: N + 1 }, (_, i) => toLatLon(P.rh((i / N) * P.rhLen)));
    const mark = same ? null : { gc: toLatLon(P.gc(frac * P.gcLen)), rh: toLatLon(P.rh(frac * P.rhLen)) };

    // ── 왼쪽: 메르카토르 ──
    const mW = mid - 16, mH = Math.min(h - 50, mW * 1.05);
    const mox = 8, moy = 26 + (h - 50 - mH) / 2;
    const lonScale = mW / TAU, latScale = (mH / 2) / mercY(MAX_LAT);
    const toMerc = (lat, lon) => ({
      x: mox + mW / 2 + lon * lonScale,
      y: moy + mH / 2 - mercY(clamp(lat, -MAX_LAT, MAX_LAT)) * latScale,
    });
    ctx.fillStyle = colors.bg; ctx.fillRect(mox, moy, mW, mH);
    ctx.strokeStyle = colors.border; ctx.lineWidth = 0.7;
    for (let lon = -180; lon <= 180; lon += 30) { const p = toMerc(0, lon * DEG); ctx.beginPath(); ctx.moveTo(p.x, moy); ctx.lineTo(p.x, moy + mH); ctx.stroke(); }
    for (let lat = -60; lat <= 60; lat += 30) { const p = toMerc(lat * DEG, 0); ctx.beginPath(); ctx.moveTo(mox, p.y); ctx.lineTo(mox + mW, p.y); ctx.stroke(); }
    ctx.strokeRect(mox, moy, mW, mH);

    function mercLine(pts, style, lw, dash) {
      ctx.strokeStyle = style; ctx.lineWidth = lw; ctx.setLineDash(dash || []);
      ctx.beginPath(); let prev = null;
      for (const [lat, lon] of pts) {
        const p = toMerc(lat, lon);
        if (prev === null || Math.abs(p.x - prev) > mW * 0.5) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        prev = p.x;
      }
      ctx.stroke(); ctx.setLineDash([]);
    }
    mercLine(rhPts, colors.fgMuted, 2, [6, 4]);
    mercLine(gcPts, pal.curve, 2.8);

    // ── 오른쪽: 지구본 ──
    const sCx = mid + (w - mid) / 2, sCy = h / 2 + 4;
    const sR = Math.min(w - mid, h) * 0.4;
    const { y: ry, x: rx } = rot.current;
    const pr = (lat, lon) => { const [x, y, z] = ll(lat, lon); return project3D([x * sR, z * sR, -y * sR], sCx, sCy, 1, ry, rx); };
    ctx.strokeStyle = colors.border; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(sCx, sCy, sR, 0, TAU); ctx.stroke();
    function sphLine(pts, style, lw, dash) {
      ctx.strokeStyle = style; ctx.lineWidth = lw; ctx.setLineDash(dash || []);
      ctx.beginPath(); let on = false;
      for (const [lat, lon] of pts) {
        const q = pr(lat, lon);
        if (q.z >= 0) { on ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); on = true; } else on = false;
      }
      ctx.stroke(); ctx.setLineDash([]);
    }
    const ring = (fn) => Array.from({ length: 73 }, (_, i) => fn(i / 72));
    for (let lat = -60; lat <= 60; lat += 30) sphLine(ring(t => [lat * DEG, t * TAU - Math.PI]), colors.border, 0.8);
    for (let lon = 0; lon < 180; lon += 30) sphLine(ring(t => [Math.PI / 2 - t * TAU, lon * DEG]), colors.border, 0.8);
    sphLine(rhPts, colors.fgMuted, 2, [5, 3]);
    sphLine(gcPts, pal.curve, 2.8);

    // 도시와 지점 표시
    for (const c of CITIES) {
      const active = c === from || c === to;
      const m = toMerc(c.lat, c.lon), q = pr(c.lat, c.lon);
      ctx.fillStyle = active ? colors.fg : colors.fgMuted;
      for (const [x, y, vis] of [[m.x, m.y, true], [q.x, q.y, q.z >= 0]]) {
        if (!vis) continue;
        ctx.beginPath(); ctx.arc(x, y, active ? 4.5 : 2.5, 0, TAU); ctx.fill();
        if (active) { ctx.font = '11px sans-serif'; ctx.fillText(c.name, x + 6, y - 5); }
      }
    }
    if (mark) {
      for (const [key, style] of [['gc', pal.curve], ['rh', colors.fgMuted]]) {
        const [lat, lon] = mark[key];
        const m = toMerc(lat, lon), q = pr(lat, lon);
        ctx.strokeStyle = style; ctx.lineWidth = 2.5; ctx.fillStyle = colors.bg;
        for (const [x, y, vis] of [[m.x, m.y, true], [q.x, q.y, q.z >= 0]]) {
          if (!vis) continue;
          ctx.beginPath(); ctx.arc(x, y, 6, 0, TAU); ctx.fill(); ctx.stroke();
        }
      }
    }

    ctx.fillStyle = colors.fgMuted; ctx.font = '12px sans-serif';
    ctx.fillText('메르카토르 지도', mox, 16);
    ctx.fillText('지구본 (끌어서 회전)', mid + 8, 16);
  };

  const canvasRef = useCanvas(drawRef);
  usePointer(canvasRef, {
    onDown: (pos) => { drag.current = { mx: pos.x, my: pos.y, ry: rot.current.y, rx: rot.current.x }; },
    onDrag: (pos) => {
      const d = drag.current; if (!d) return;
      rot.current = { y: d.ry + (pos.x - d.mx) * 0.01, x: Math.max(-1.4, Math.min(1.4, d.rx + (pos.y - d.my) * 0.01)) };
    },
    onUp: () => { drag.current = null; },
  });

  const G = HEX.curve, CN = HEX.conn;
  const f = (v) => (Math.abs(v) < 5e-4 ? '0.000' : v.toFixed(3));
  const table = terms && `\\begin{array}{lrr}
 & \\text{대원} & \\text{등각항로} \\\\ \\hline
\\ddot{\\textcolor{${G}}{\\theta}} & ${f(terms.gc.tdd)} & ${f(terms.rh.tdd)} \\\\
\\textcolor{${CN}}{\\Gamma}^\\theta_{\\phi\\phi}\\,\\dot{\\textcolor{${G}}{\\phi}}^2 & ${f(terms.gc.gT)} & ${f(terms.rh.gT)} \\\\
\\text{합 (}\\theta\\text{ 식)} & \\mathbf{${f(terms.gc.sT)}} & \\mathbf{${f(terms.rh.sT)}} \\\\ \\hline
\\ddot{\\textcolor{${G}}{\\phi}} & ${f(terms.gc.pdd)} & ${f(terms.rh.pdd)} \\\\
2\\textcolor{${CN}}{\\Gamma}^\\phi_{\\theta\\phi}\\,\\dot{\\textcolor{${G}}{\\theta}}\\dot{\\textcolor{${G}}{\\phi}} & ${f(terms.gc.gP)} & ${f(terms.rh.gP)} \\\\
\\text{합 (}\\phi\\text{ 식)} & \\mathbf{${f(terms.gc.sP)}} & \\mathbf{${f(terms.rh.sP)}} \\\\ \\hline
\\text{길이} & ${Math.round(P.gcLen * EARTH).toLocaleString()}\\ \\text{km} & ${Math.round(Math.abs(P.rhLen) * EARTH).toLocaleString()}\\ \\text{km}
\\end{array}`;

  return (
    <div class="viz-inner">
      <div class="viz-message">
        대원 위에서는 좌표 가속도와 <Tex>{`\\textcolor{${CN}}{\\Gamma}`}</Tex> 항이 매 순간 정확히 상쇄되어 합이 0이다. 지도 위의 직선(등각항로)은 합이 0이 아니라서, 따라가려면 계속 핸들을 꺾어야 한다.
      </div>
      <canvas ref={canvasRef} />
      <div class="viz-formula">
        <div><Tex display>{`\\ddot{\\textcolor{${G}}{\\gamma}}^k + \\textcolor{${CN}}{\\Gamma}^k_{ij}\\,\\dot{\\textcolor{${G}}{\\gamma}}^i\\dot{\\textcolor{${G}}{\\gamma}}^j = 0`}</Tex></div>
        {terms
          ? <div><Tex display>{table}</Tex></div>
          : <div style={{ color: 'var(--fg-muted)' }}>출발과 도착을 다르게 고르세요.</div>}
        <div style={{ color: 'var(--fg-muted)', fontSize: '0.85em' }}>
          반지름 1인 구, 호의 길이로 매개화(속력 1). 값은 경로 위의 한 점에서 수치 미분으로 구했다.
        </div>
      </div>
      <div class="viz-controls">
        <label class="viz-select"><span>출발</span>
          <select value={fromIdx} onChange={e => setFromIdx(+e.target.value)}>
            {CITIES.map((c, i) => <option key={i} value={i}>{c.name}</option>)}
          </select>
        </label>
        <label class="viz-select"><span>도착</span>
          <select value={toIdx} onChange={e => setToIdx(+e.target.value)}>
            {CITIES.map((c, i) => <option key={i} value={i}>{c.name}</option>)}
          </select>
        </label>
        <Slider label="지점" min={0.05} max={0.95} step={0.01} value={frac} onChange={setFrac} />
        <span style={{ fontSize: '0.85em', color: 'var(--fg-muted)' }}>
          <span style={{ color: pal.curve, fontWeight: 700 }}>━</span> 대원(측지선) · <span style={{ fontWeight: 700 }}>┅</span> 등각항로(지도 위 직선)
        </span>
      </div>
    </div>
  );
}

export function mount(el) { render(<Ch06Viz />, el); }
