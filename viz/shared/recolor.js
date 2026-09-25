// KaTeX 출력의 color:#hex 를 palette 의 CSS 변수로 바꾼다. build.cjs 와 위젯(tex.jsx)이 함께 쓴다.
const PALETTE = require('./palette.json');

const HEX2VAR = {};
for (const [k, v] of Object.entries(PALETTE)) {
  if (k.startsWith('_')) continue;
  HEX2VAR[v.light.toLowerCase()] = `var(--c-${k},${v.light})`;
}

function recolorKatex(html) {
  return html.replace(/color:\s*(#[0-9a-fA-F]{6})/g, (m, hex) => {
    const v = HEX2VAR[hex.toLowerCase()];
    return v ? 'color:' + v : m;
  });
}

// :root / 다크 테마 CSS 변수 선언
function paletteCss() {
  const light = [], dark = [];
  for (const [k, v] of Object.entries(PALETTE)) {
    if (k.startsWith('_')) continue;
    light.push(`--c-${k}:${v.light};`);
    dark.push(`--c-${k}:${v.dark};`);
  }
  return `:root{${light.join('')}}[data-theme="dark"]{${dark.join('')}}`;
}

module.exports = { recolorKatex, paletteCss, HEX2VAR };
