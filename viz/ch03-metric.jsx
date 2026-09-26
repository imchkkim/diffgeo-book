// 3장 — 메르카토르 지도 위의 티소 지시원.
// 구면 위에서 모두 같은 크기인 작은 원이 지도에서는 원 모양 그대로(등각) 1/sinθ 배로 부푼다.
// 색: 좌표 θ, φ = coord / 계량·눈금 = metric (palette.json).
import { render } from 'preact';
import { useState, useRef } from 'preact/hooks';
import { useCanvas, usePointer } from './shared/canvas-utils.jsx';
import { Slider } from './shared/controls.jsx';
import { useThemeColors } from './shared/theme.jsx';
import { usePalette, HEX } from './shared/palette.js';
import { Tex } from './shared/tex.jsx';

const TAU = 2 * Math.PI;
const DEG = Math.PI / 180;
const LAT_MAX = 80 * DEG;
const RHO = 5 * DEG;            // 지시원의 실제(구면 위) 반지름, 각도 단위
const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + lat / 2));
const invMercY = (y) => 2 * Math.atan(Math.exp(y)) - Math.PI / 2;

function Ch03Viz() {
  const colors = useThemeColors();
  const pal = usePalette();
  const [sel, setSel] = useState({ lat: 60 * DEG, lon: 20 * DEG });
  const selRef = useRef(sel);
  selRef.current = sel;
  const drag = useRef(false);

  function frame(w, h) {
    const mapW = w - 24, ox = 12;
    const s = mapW / TAU;                 // 적도 배율: 경도 1 라디안 = s px
    const mapH = Math.min(h - 24, 2 * mercY(LAT_MAX) * s);
    const sy = mapH / (2 * mercY(LAT_MAX));
    const k = Math.min(s, sy);
    const oy = (h - 2 * mercY(LAT_MAX) * k) / 2;
    const toS = (lat, lon) => [ox + mapW / 2 + lon * k, oy + mercY(LAT_MAX) * k - mercY(lat) * k];
    return { k, toS, ox, oy, mapW, H: 2 * mercY(LAT_MAX) * k,
      fromS: (x, y) => [invMercY((oy + mercY(LAT_MAX) * k - y) / k), (x - ox - mapW / 2) / k] };
  }

  const drawRef = useRef(null);
  drawRef.current = (ctx, w, h) => {
    const F = frame(w, h);
    const { k, toS } = F;
    const x0 = toS(0, -Math.PI)[0], x1 = toS(0, Math.PI)[0];
    ctx.fillStyle = colors.bg;
    ctx.fillRect(x0, F.oy, x1 - x0, F.H);

    // 격자: 경선은 같은 간격, 위선 간격은 극으로 갈수록 넓어짐
    ctx.strokeStyle = colors.border; ctx.lineWidth = 1;
    ctx.font = '11px sans-serif'; ctx.fillStyle = colors.fgMuted;
    for (let lon = -180; lon <= 180; lon += 30) {
      const [x] = toS(0, lon * DEG);
      ctx.beginPath(); ctx.moveTo(x, F.oy); ctx.lineTo(x, F.oy + F.H); ctx.stroke();
    }
    for (let lat = -75; lat <= 75; lat += 15) {
      const [, y] = toS(lat * DEG, 0);
      ctx.strokeStyle = lat === 0 ? colors.fgMuted : colors.border;
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
      if (lat % 30 === 0) ctx.fillText(`${lat}°`, x0 + 3, y - 3);
    }

    // 모든 지시원: 실제로는 같은 크기 → 지도 반지름 = ρ·k / cos(위도)
    ctx.strokeStyle = pal.metric; ctx.lineWidth = 1;
    for (let lat = -60; lat <= 60; lat += 15) {
      for (let lon = -165; lon <= 165; lon += 30) {
        const [x, y] = toS(lat * DEG, lon * DEG);
        const r = RHO * k / Math.cos(lat * DEG);
        ctx.globalAlpha = 0.14; ctx.fillStyle = pal.metric;
        ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
        ctx.globalAlpha = 0.5; ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;

    // 선택한 지시원 + 적도에서의 크기(점선) 비교
    const { lat, lon } = selRef.current;
    const [cx, cy] = toS(lat, lon);
    const r0 = RHO * k, r = r0 / Math.cos(lat);
    ctx.fillStyle = pal.metric; ctx.globalAlpha = 0.28;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1; ctx.strokeStyle = pal.metric; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.strokeStyle = colors.fg; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.arc(cx, cy, r0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    // 경도 방향(가로)·여위도 방향(세로) 반지름 표시: 둘 다 같은 배율
    ctx.strokeStyle = pal.coord; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + r, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy + r); ctx.stroke();
    ctx.fillStyle = pal.coord; ctx.font = 'italic bold 13px serif';
    ctx.fillText('φ', cx + r + 4, cy + 4);
    ctx.fillText('θ', cx + 4, cy + r + 13);
    ctx.fillStyle = colors.fg;
    ctx.beginPath(); ctx.arc(cx, cy, 3, 0, TAU); ctx.fill();

    ctx.fillStyle = colors.fgMuted; ctx.font = '12px sans-serif';
    ctx.fillText('지도를 끌어 원을 옮기기 · 점선 = 적도에서의 크기', x0 + 4, F.oy + F.H - 6);
  };

  const canvasRef = useCanvas(drawRef);
  function pick(q) {
    const c = canvasRef.current;
    const F = frame(c.clientWidth, c.clientHeight);
    let [lat, lon] = F.fromS(q.x, q.y);
    lat = Math.max(-75 * DEG, Math.min(75 * DEG, lat));
    lon = Math.max(-Math.PI, Math.min(Math.PI, lon));
    setSel({ lat, lon });
  }
  usePointer(canvasRef, {
    onDown: (q) => { drag.current = true; pick(q); },
    onDrag: (q) => { if (drag.current) pick(q); },
    onUp: () => { drag.current = false; },
  });

  const C = HEX.coord, M = HEX.metric, RD = HEX.radius;
  const latDeg = sel.lat / DEG;
  const thetaDeg = 90 - latDeg;
  const sinT = Math.sin((90 - latDeg) * DEG);
  const mag = 1 / sinT;

  return (
    <div class="viz-inner">
      <div class="viz-message">
        지도 위의 원은 어디서나 원으로 남는다(각도 보존). 대신 반지름은 <Tex>{`1/\\sin\\textcolor{${C}}{\\theta}`}</Tex>배, 넓이는 <Tex>{`1/\\sin^2\\textcolor{${C}}{\\theta}`}</Tex>배로 부푼다. 구면 위에서는 모두 같은 크기의 원이다.
      </div>
      <canvas ref={canvasRef} />
      <div class="viz-formula">
        <div>
          <Tex>{`\\textcolor{${M}}{ds}^2 = \\textcolor{${RD}}{R}^2\\left(d\\textcolor{${C}}{\\theta}^2 + \\sin^2\\textcolor{${C}}{\\theta}\\,d\\textcolor{${C}}{\\phi}^2\\right) = \\textcolor{${RD}}{R}^2\\left(d\\textcolor{${C}}{\\theta}^2 + ${(sinT * sinT).toFixed(3)}\\,d\\textcolor{${C}}{\\phi}^2\\right)`}</Tex>
        </div>
        <div>
          <Tex>{`\\text{위도 } ${latDeg.toFixed(0)}^\\circ \\;\\Rightarrow\\; \\textcolor{${C}}{\\theta} = ${thetaDeg.toFixed(0)}^\\circ,\\quad \\text{지도 배율 } \\frac{1}{\\sin\\textcolor{${C}}{\\theta}} = ${mag.toFixed(2)},\\quad \\text{넓이 배율 } ${(mag * mag).toFixed(2)}`}</Tex>
        </div>
        <div>
          <Tex>{`\\text{지도 1 cm} = ${(111.19 * sinT).toFixed(1)}\\ \\text{km}\\quad(\\text{적도에서 } 111.2\\ \\text{km 인 축척})`}</Tex>
        </div>
      </div>
      <div class="viz-controls">
        <Slider label="위도 (°)" min={-75} max={75} step={1} value={Math.round(latDeg)}
          onChange={(v) => setSel({ lat: v * DEG, lon: sel.lon })} />
      </div>
    </div>
  );
}

export function mount(el) { render(<Ch03Viz />, el); }
