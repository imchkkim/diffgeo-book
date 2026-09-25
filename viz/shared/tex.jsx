// 위젯 안 수식을 본문과 같은 KaTeX 로 그린다. 색은 \textcolor{HEX.metric}{g} 처럼 light hex 로 쓰면
// 본문과 똑같이 CSS 변수로 치환되어 다크 모드를 따른다.
import { h } from 'preact';
import { useMemo } from 'preact/hooks';
import katex from 'katex';
import { recolorKatex } from './recolor.js';

export function Tex({ children, display = false, class: cls }) {
  const src = Array.isArray(children) ? children.join('') : String(children ?? '');
  const html = useMemo(() => {
    try {
      return recolorKatex(katex.renderToString(src, { displayMode: display, throwOnError: false, output: 'html' }));
    } catch (e) {
      return src;
    }
  }, [src, display]);
  return <span class={'viz-tex' + (cls ? ' ' + cls : '')} dangerouslySetInnerHTML={{ __html: html }} />;
}
