const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const markdownit = require("markdown-it");
const texmath = require("markdown-it-texmath");
const katex = require("katex");
const esbuild = require("esbuild");
const { recolorKatex, paletteCss, HEX2VAR } = require("./viz/shared/recolor.js");

// Source dir (manuscript) and dist dir passed as arguments or defaults
const SRC = process.argv[2] || path.dirname(__filename);
const DIST = process.argv[3] || path.join(SRC, "dist");
const TITLE = "미분기하학의 언어들";

// Chapter order
// 절 단위 페이지: 본문 장(01~12)은 ## 절마다 한 페이지로 나눈다(첫 절은 slug.html = 옛 장 주소, 그다음 slug-2.html …).
// 첫 ## 이 「출발 문제」(또는 「이 장의 물음」)면 혼자 짧은 페이지가 되지 않게 장 제목과 함께 첫 절 페이지 머리에 붙인다.
// 서문(00)·에필로그(99)·부록(A)은 한 페이지로 둔다. 규칙 원본: ~/.claude/skills/chapter-section-edit/SKILL.md 「1. 페이지 나누기」
const NO_SPLIT = new Set(["00", "99", "A-"]);
const chapters = [
  "00-서문.md",
  "01-좌표하나로는지구를담을수없다.md",
  "02-곡면위에서속도를말하려면.md",
  "03-거리를재는눈금이장소마다다르다.md",
  "04-미분했더니좌표가섞여들어온다.md",
  "05-벡터를옮기면달라진다.md",
  "06-곡면위의직선은뭔가.md",
  "07-얼마나휘었는지를어떻게숫자로말하나.md",
  "08-안에서만보고도휘어짐을안다.md",
  "09-곡률을요약하는법.md",
  "10-같은공간에접속이두개.md",
  "11-거리아닌거리직선아닌직선.md",
  "12-매개변수공간의풍경을걷다.md",
  "99-에필로그.md",
  "A-부록.md",
];

// Initialize markdown-it with KaTeX
const md = markdownit({ html: true, linkify: true, typographer: true });
md.use(texmath, {
  engine: katex,
  delimiters: "dollars",
  katexOptions: { throwOnError: false, trust: true },
});

// 표는 가로 스크롤 상자로 감싼다 — 휴대폰 폭에서 넓은 표만 옆으로 밀어 보고, 쪽 전체가 가로로 밀리지 않게
md.renderer.rules.table_open = () => '<div class="table-wrap"><table>\n';
md.renderer.rules.table_close = () => '</table></div>\n';

// 그림: 그림만으로 된 문단(![설명](파일) 한 줄, 또는 여러 장을 한 줄에)은 문단 대신 그림 상자로 그린다.
//   개념 그림 → <figure class="fig"><img><figcaption>설명(수식도 그림)</figcaption></figure>
//   초상     → <figure class="fig fig-portrait"><img></figure> — 설명 줄 없이 대체 글(alt)로만. 오른쪽에 작게 띄운다
// 초상을 가르는 기준: 「### 역사: …」 소제목 바로 다음에 놓인 그림 문단. (저자 결정 2026-09-27: 개념 그림만 설명을 보인다)
const isImageParagraph = (inline) =>
  inline && inline.type === "inline" && inline.children.some((t) => t.type === "image") &&
  inline.children.every((t) => t.type === "image" || t.type === "softbreak" || (t.type === "text" && !t.content.trim()));
const afterHistoryHeading = (tokens, idx) =>
  idx >= 2 && tokens[idx - 1].type === "heading_close" && tokens[idx - 1].tag === "h3" && /^역사\s*:/.test(tokens[idx - 2].content);
const defaultParagraphOpen = md.renderer.rules.paragraph_open || ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));
const defaultParagraphClose = md.renderer.rules.paragraph_close || ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));
md.renderer.rules.paragraph_open = (tokens, idx, options, env, self) => {
  const inline = tokens[idx + 1];
  if (!isImageParagraph(inline)) return defaultParagraphOpen(tokens, idx, options, env, self);
  const portrait = afterHistoryHeading(tokens, idx);
  for (const t of inline.children) if (t.type === "image") t.meta = { ...(t.meta || {}), figure: portrait ? "portrait" : "fig" };
  tokens[idx + 2].meta = { ...(tokens[idx + 2].meta || {}), figure: true };
  return "";
};
md.renderer.rules.paragraph_close = (tokens, idx, options, env, self) =>
  tokens[idx].meta && tokens[idx].meta.figure ? "\n" : defaultParagraphClose(tokens, idx, options, env, self);
const defaultImage = md.renderer.rules.image;
md.renderer.rules.image = (tokens, idx, options, env, self) => {
  const t = tokens[idx];
  const img = defaultImage(tokens, idx, options, env, self);
  if (!t.meta || !t.meta.figure) return img;
  if (t.meta.figure === "portrait") return `<figure class="fig fig-portrait">${img}</figure>`;
  return `<figure class="fig">${img}<figcaption>${self.renderInline(t.children, options, env)}</figcaption></figure>`;
};

// Custom renderer: fenced code blocks with language "mermaid" → <pre class="mermaid">
const defaultFence =
  md.renderer.rules.fence ||
  function (tokens, idx, options, env, self) {
    return self.renderToken(tokens, idx, options);
  };

md.renderer.rules.fence = function (tokens, idx, options, env, self) {
  const token = tokens[idx];
  if (token.info.trim() === "mermaid") {
    return '<pre class="mermaid">' + md.utils.escapeHtml(token.content) + "</pre>";
  }
  return defaultFence(tokens, idx, options, env, self);
};

// Build
fs.mkdirSync(DIST, { recursive: true });
// 절 페이지 수가 바뀌면 옛 페이지가 남으므로 최상위 html 은 비우고 다시 쓴다
for (const f of fs.readdirSync(DIST)) if (f.endsWith(".html")) fs.rmSync(path.join(DIST, f));

// KaTeX CSS·글꼴은 실행한 폴더(cwd)의 node_modules 에서 읽는다: 로컬 빌드는 저장소 루트,
// 공용 배포 도구(~/lameproof/lib/build.cjs)는 npm ci 를 돌린 임시 폴더에서 이 파일을 실행한다
const katexCssPath = path.join(process.cwd(), "node_modules", "katex", "dist", "katex.min.css");
const katexCss = fs.readFileSync(katexCssPath, "utf-8");

// Copy KaTeX fonts
const katexFontsSrc = path.join(process.cwd(), "node_modules", "katex", "dist", "fonts");
const katexFontsDst = path.join(DIST, "fonts");
fs.mkdirSync(katexFontsDst, { recursive: true });
for (const f of fs.readdirSync(katexFontsSrc)) {
  fs.copyFileSync(path.join(katexFontsSrc, f), path.join(katexFontsDst, f));
}

// Copy images
const imgSrc = path.join(SRC, "images");
const imgDst = path.join(DIST, "images");
if (fs.existsSync(imgSrc)) {
  fs.cpSync(imgSrc, imgDst, { recursive: true });
}

// Compile viz JSX bundles
const vizSrc = path.join(SRC, "viz");
const vizDst = path.join(DIST, "viz");
const vizBundles = new Map(); // 위젯 이름 → 내용 해시
if (fs.existsSync(vizSrc)) {
  const vizFiles = fs.readdirSync(vizSrc).filter(f => f.startsWith("ch") && f.endsWith(".jsx"));
  if (vizFiles.length > 0) {
    fs.rmSync(vizDst, { recursive: true, force: true });
    fs.mkdirSync(vizDst, { recursive: true });
    // splitting: preact·katex·shared 를 공통 청크로 한 번만 받게 한다
    esbuild.buildSync({
      entryPoints: vizFiles.map(vf => path.join(vizSrc, vf)),
      outdir: vizDst,
      bundle: true,
      splitting: true,
      minify: true,
      format: "esm",
      jsx: "automatic",
      jsxImportSource: "preact",
      target: ["es2020"],
      nodePaths: [path.join(SRC, "node_modules")],
    });
    for (const vf of vizFiles) {
      const id = vf.replace(".jsx", "");
      // 캐시 무효화용 내용 해시 — 옛 입구 파일이 캐시에 남아 사라진 공통 청크를 가리키지 않게 주소에 붙인다.
      // 입구 파일은 공통 청크 이름(esbuild 가 내용으로 지음)을 품으므로 입구 파일만 해시해도 청크 변경이 따라 잡힌다
      vizBundles.set(id, crypto.createHash("sha1").update(fs.readFileSync(path.join(vizDst, id + ".js"))).digest("hex").slice(0, 8));
      console.log("  viz:", vf);
    }
  }
}

// Read our CSS
// 문제 본문 상자(.exercises)는 테마와 관계없이 흰 바탕이므로 수식 기호 색도 라이트 값으로 고정한다
const exercisePaletteCss =
  ".exercises{" +
  Object.entries(HEX2VAR).map(([hex, v]) => `--c-${v.match(/--c-([\w-]+)/)[1]}:${hex};`).join("") +
  "}";
const appCss = fs.readFileSync(path.join(SRC, "style.css"), "utf-8") + "\n" + paletteCss() + "\n" + exercisePaletteCss;

// ── 대화: "**김민준 〔M04〕:** …" 문단을 말풍선 차례로 바꾼다 ──
// 모든 차례에 인물 표정 그림(images/cast/<인덱스>.webp)을 둔다. 〔인덱스〕가 없으면 평상 표정(T01·M01·S01), 파일이 없으면 빈 자리 표시.
// 표정 그림 원본은 교재 공용 폴더(~/lameproof/shared/characters/assets). 책 안에 사본을 두지 않고 빌드 때 dist 로 복사한다.
const CAST_DIR = path.join(os.homedir(), "lameproof", "shared", "characters", "assets");
if (fs.existsSync(CAST_DIR)) {
  fs.mkdirSync(path.join(DIST, "images", "cast"), { recursive: true });
  for (const f of fs.readdirSync(CAST_DIR)) fs.copyFileSync(path.join(CAST_DIR, f), path.join(DIST, "images", "cast", f));
}
const SPEAKERS = { "선생님": "T", "김민준": "M", "이서연": "S" };
const CAST_EXT = [".png", ".webp", ".jpg", ".svg"];
function castFigure(idx, who) {
  const ext = CAST_EXT.find(e => fs.existsSync(path.join(CAST_DIR, idx + e)));
  const inner = ext
    ? `<img src="images/cast/${idx}${ext}" alt="${who} ${idx}">`
    : `<span class="cast-slot">${who === "선생님" ? "선생님" : who.slice(1)}<small>${idx}</small></span>`;
  return `<figure class="cast" data-cast="${idx}">${inner}<figcaption>${who}</figcaption></figure>`;
}
function renderDialogue(html) {
  return html.replace(
    /<p><strong>(선생님|김민준|이서연)(?:\s*〔([TMS]\d{2})〕)?\s*[:：]<\/strong>\s*([\s\S]*?)<\/p>/g,
    (m, who, idx, body) => {
      const k = SPEAKERS[who];
      // 모든 차례에 표정 그림(인덱스가 없으면 평상 표정 T01·M01·S01)과 그 아래 이름 — 좌우 정렬을 맞춘다
      const fig = castFigure(idx || k + "01", who);
      return `<div class="turn turn-${k} has-cast">${fig}<div class="turn-body"><p>${body}</p></div></div>`;
    }
  );
}

// ── h2/h3 에 앵커 id, 장 안의 절 목록(toc) ──
function addHeadingIds(html, toc) {
  const used = new Set();
  return html.replace(/<(h[23])>([\s\S]*?)<\/\1>/g, (m, tag, inner) => {
    const text = inner.replace(/<[^>]+>/g, "").trim();
    let id = text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "") || "sec";
    let k = id, n = 2;
    while (used.has(k)) k = `${id}-${n++}`;
    used.add(k);
    if (tag === "h2") toc.push({ id: k, text });
    return `<${tag} id="${k}">${inner}</${tag}>`;
  });
}

// ── 장 HTML → 절 페이지. 첫 h2 앞(장 제목)과 도입 절(출발 문제 / 이 장의 물음)은 첫 절 페이지 머리에 붙인다 ──
const INTRO_H2 = /^<h2[^>]*>\s*(출발 문제|이 장의 물음)/;
function splitPages(slug, html, toc, split) {
  if (!split) return [{ file: slug + ".html", html, sec: null }];
  const parts = html.split(/(?=<h2[ >])/);
  let head = /^\s*<h2[ >]/.test(parts[0]) ? "" : parts.shift();
  const secs = toc.slice();
  if (parts.length > 1 && INTRO_H2.test(parts[0])) {
    head += parts.shift();
    secs.shift();
  }
  return parts.map((p, i) => ({
    file: i === 0 ? slug + ".html" : `${slug}-${i + 1}.html`,
    html: (i === 0 ? head : "") + p,
    sec: secs[i],
  }));
}

// ── Parse all chapters ──
const chapterData = [];
let katexErrorCount = 0;
for (const file of chapters) {
  const filePath = path.join(SRC, file);
  if (!fs.existsSync(filePath)) {
    console.warn("SKIP (not found):", file);
    continue;
  }
  const raw = fs.readFileSync(filePath, "utf-8");
  const toc = [];
  const html = addHeadingIds(renderDialogue(recolorKatex(md.render(raw))), toc);
  // markdown-it-texmath 는 throwOnError:false 라 오류를 빨간 글자로만 남긴다. 개수를 모아 알린다
  const kerr = (html.match(/class="katex-error"/g) || []).length;
  if (kerr) { katexErrorCount += kerr; console.warn(`  KaTeX 오류 ${kerr}건: ${file}`); }
  const slug = file.replace(/\.md$/, "").replace(/ /g, "-");
  const headingMatch = raw.match(/^#{1,2}\s+(.+)$/m);
  const title = headingMatch ? headingMatch[1] : slug;
  const split = !NO_SPLIT.has(file.slice(0, 2));
  chapterData.push({ slug, title, html, file, toc, pages: splitPages(slug, html, toc, split) });
}

// ── Shared HTML shell ──
// 사이드바: 지금 장이 여러 페이지면 절 페이지 목록(현재 절 강조), 한 페이지면 절 앵커 목록
function buildSidebarHtml(activeSlug, activeFile) {
  return chapterData
    .map((ch) => {
      const active = ch.slug === activeSlug;
      const paged = ch.pages.length > 1;
      const sub = !active
        ? ""
        : paged
        ? `<ul class="sidebar-toc">${ch.pages
            .map((p) => `<li><a href="${p.file}"${p.file === activeFile ? ' class="current"' : ""}>${p.sec.text}</a></li>`)
            .join("")}</ul>`
        : ch.toc.length
        ? `<ul class="sidebar-toc">${ch.toc.map((t) => `<li><a href="#${t.id}">${t.text}</a></li>`).join("")}</ul>`
        : "";
      return `<li><a href="${ch.slug}.html"${active ? ' class="active"' : ""}>${ch.title}</a>${sub}</li>`;
    })
    .join("\n");
}

const scriptBlock = `<script type="module">
// Dark mode
const toggle = document.getElementById('theme-toggle');
const stored = localStorage.getItem('theme');
if (stored === 'dark' || (!stored && matchMedia('(prefers-color-scheme: dark)').matches)) {
  document.documentElement.setAttribute('data-theme', 'dark');
  toggle.textContent = '\\u2600\\uFE0F';
}
toggle.addEventListener('click', () => {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
  localStorage.setItem('theme', isDark ? 'light' : 'dark');
  toggle.textContent = isDark ? '\\u{1F319}' : '\\u2600\\uFE0F';
});

// Sidebar
const sidebar = document.getElementById('sidebar');
const openBtn = document.getElementById('sidebar-open');
const closeBtn = document.getElementById('sidebar-close');
openBtn.addEventListener('click', () => sidebar.classList.add('open'));
closeBtn.addEventListener('click', () => sidebar.classList.remove('open'));
sidebar.querySelectorAll('a').forEach(a => {
  a.addEventListener('click', () => sidebar.classList.remove('open'));
});

// 키보드 ←/→ 로 이전·다음 페이지
addEventListener('keydown', e => {
  if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
  const a = document.querySelector(e.key === 'ArrowLeft' ? '.chapter-nav-prev' : e.key === 'ArrowRight' ? '.chapter-nav-next' : null);
  if (a) location.href = a.href;
});

// Mermaid — 테마를 바꾸면 원본 소스로 되돌려 다시 그린다
const mermaidNodes = [...document.querySelectorAll('pre.mermaid')];
mermaidNodes.forEach(n => { n.dataset.src = n.textContent; });
let mermaidLib = null;
async function renderMermaid() {
  if (!mermaidNodes.length) return;
  if (!mermaidLib) mermaidLib = (await import('https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs')).default;
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  // 다크: mermaid 내장 dark 는 회색 상자·회색 묶음 바탕이 남색 페이지와 어긋난다 → 페이지 CSS 변수로 base 테마를 칠한다
  const cs = getComputedStyle(document.documentElement), v = k => cs.getPropertyValue(k).trim();
  mermaidLib.initialize(isDark ? {
    startOnLoad: false, securityLevel: 'loose', theme: 'base',
    themeVariables: {
      darkMode: true, background: v('--bg'),
      primaryColor: v('--bg-code'), primaryTextColor: v('--fg'), primaryBorderColor: v('--fg-muted'),
      secondaryColor: v('--bg-code'), tertiaryColor: v('--bg-code'),
      lineColor: v('--fg-muted'), textColor: v('--fg'),
      clusterBkg: v('--bg'), clusterBorder: v('--fg-muted'),
      edgeLabelBackground: v('--bg'), titleColor: v('--fg'),
    },
  } : { startOnLoad: false, theme: 'default', securityLevel: 'loose' });
  mermaidNodes.forEach(n => { n.removeAttribute('data-processed'); n.textContent = n.dataset.src; });
  await mermaidLib.run({ nodes: mermaidNodes });
}
renderMermaid();
toggle.addEventListener('click', () => renderMermaid());
</script>`;

function buildPage({ pageTitle, sidebarActiveSlug, activeFile, bodyContent, vizScript }) {
  const tocHtml = buildSidebarHtml(sidebarActiveSlug, activeFile);
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${pageTitle}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<style>${katexCss}</style>
<style>${appCss}</style>
<script>
(function(){var s=localStorage.getItem('theme');if(s==='dark'||(!s&&matchMedia('(prefers-color-scheme:dark)').matches))document.documentElement.setAttribute('data-theme','dark')})();
</script>
</head>
<body>

<nav id="sidebar">
  <div class="sidebar-header">
    <h2><a href="index.html" style="color:inherit;text-decoration:none">목차</a></h2>
    <div class="sidebar-actions">
      <button id="theme-toggle" aria-label="다크모드 전환">&#x1F319;</button>
      <button id="sidebar-close" aria-label="사이드바 닫기">&times;</button>
    </div>
  </div>
  <ol>${tocHtml}</ol>
</nav>

<button id="sidebar-open" aria-label="목차 열기">&#x2630;</button>

<main>
${bodyContent}
</main>

${scriptBlock}
${vizScript || ''}
</body>
</html>`;
}

// ── Generate index.html (TOC page) ──
const indexTocHtml = chapterData
  .map((ch) => '<li><a href="' + ch.slug + '.html">' + ch.title + "</a></li>")
  .join("\n");

const indexBody = `<div class="toc-page">
<nav class="site-nav"><a href="/">&larr; 전체 교재</a></nav>
<h1>${TITLE}</h1>
<ol class="toc-list">
${indexTocHtml}
</ol>
</div>`;

fs.writeFileSync(
  path.join(DIST, "index.html"),
  buildPage({ pageTitle: TITLE, sidebarActiveSlug: null, bodyContent: indexBody }),
  "utf-8"
);

// 위젯 자리(data-viz)가 화면 가까이 오면 그 번들을 불러온다
function vizLoader(html) {
  const ids = [...new Set((html.match(/data-viz="([^"]+)"/g) || []).map((m) => m.match(/data-viz="([^"]+)"/)[1]))];
  const loaders = ids
    .filter((id) => vizBundles.has(id))
    .map((id) => `
    (function() {
      var el = document.querySelector('[data-viz="${id}"]');
      if (!el) return;
      var obs = new IntersectionObserver(function(entries) {
        if (entries[0].isIntersecting) {
          obs.disconnect();
          import('./viz/${id}.js?v=${vizBundles.get(id)}').then(function(m) { m.mount(el); });
        }
      }, { rootMargin: '200px' });
      obs.observe(el);
    })();`);
  return loaders.length ? '<script type="module">' + loaders.join("\n") + "\n</script>" : "";
}

// ── 페이지 쓰기: 모든 페이지를 한 줄로 늘어놓고 이전/다음을 잇는다(절 페이지는 장 경계를 넘어 이어진다) ──
const allPages = chapterData.flatMap((ch) => ch.pages.map((p, k) => ({ ch, p, k })));
const navLabel = ({ ch, p }) => (p.sec && ch.pages.length > 1 ? p.sec.text : ch.title);
allPages.forEach(({ ch, p, k }, i) => {
  const prev = allPages[i - 1], next = allPages[i + 1];
  const paged = ch.pages.length > 1;
  const nav =
    '<nav class="chapter-nav">' +
    (prev ? `<a class="chapter-nav-prev" href="${prev.p.file}">&larr; ${navLabel(prev)}</a>` : "<span></span>") +
    (paged ? `<span class="page-count">${k + 1} / ${ch.pages.length}</span>` : "") +
    (next ? `<a class="chapter-nav-next" href="${next.p.file}">${next.ch !== ch ? next.ch.title : navLabel(next)} &rarr;</a>` : "<span></span>") +
    "</nav>";
  // 둘째 절부터는 어느 장인지 위에 작게 적는다
  const crumb = paged && k > 0 ? `<p class="chapter-crumb"><a href="${ch.pages[0].file}">${ch.title}</a></p>\n` : "";
  const bodyContent =
    `<section class="chapter${paged ? " chapter-paged" : ""}">\n${crumb}${p.html}\n</section>\n${nav}`;
  const pageHtml = buildPage({
    pageTitle: paged && k > 0 ? `${p.sec.text} — ${ch.title} — ${TITLE}` : `${ch.title} — ${TITLE}`,
    sidebarActiveSlug: ch.slug,
    activeFile: p.file,
    bodyContent,
    vizScript: vizLoader(p.html),
  });
  fs.writeFileSync(path.join(DIST, p.file), pageHtml, "utf-8");
});

if (katexErrorCount) console.warn(`  KaTeX 오류 합계 ${katexErrorCount}건`);
console.log(`Built ${chapterData.length} chapters (${allPages.length} pages) + index.html -> ${DIST}`);
