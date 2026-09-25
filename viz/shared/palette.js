// 개념별 색. 값은 palette.json 한 곳에서만 정의한다(docs/집필노트.md §1).
import { useState, useEffect } from 'preact/hooks';
import PALETTE from './palette.json';

const KEYS = Object.keys(PALETTE).filter(k => !k.startsWith('_'));

function isDark() {
  return document.documentElement.getAttribute('data-theme') === 'dark';
}

function pick(dark) {
  const out = {};
  for (const k of KEYS) out[k] = dark ? PALETTE[k].dark : PALETTE[k].light;
  return out;
}

// 현재 테마에 맞는 { coord, dir, field, metric, ... } 색을 돌려준다.
export function usePalette() {
  const [pal, setPal] = useState(() => pick(isDark()));
  useEffect(() => {
    const obs = new MutationObserver(() => setPal(pick(isDark())));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
  return pal;
}

// TeX 문자열용: 원고와 같은 light hex. Tex 컴포넌트가 렌더 후 CSS 변수로 바꾼다.
export const HEX = pick(false);
export { PALETTE, KEYS };
