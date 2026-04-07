const fs = require("fs");
const path = require("path");
const markdownit = require("markdown-it");
const texmath = require("markdown-it-texmath");
const katex = require("katex");
const esbuild = require("esbuild");

// Source dir (manuscript) and dist dir passed as arguments or defaults
const SRC = process.argv[2] || path.dirname(__filename);
const DIST = process.argv[3] || path.join(SRC, "dist");
const TITLE = "미분기하학의 언어들";

// Chapter order
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

// Read KaTeX CSS from node_modules (in CWD, i.e. /tmp/diffgeo-build)
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
  fs.mkdirSync(imgDst, { recursive: true });
  for (const f of fs.readdirSync(imgSrc)) {
    fs.copyFileSync(path.join(imgSrc, f), path.join(imgDst, f));
  }
}

// Compile viz JSX bundles
const vizSrc = path.join(SRC, "viz");
const vizDst = path.join(DIST, "viz");
const vizBundles = new Set();
if (fs.existsSync(vizSrc)) {
  const vizFiles = fs.readdirSync(vizSrc).filter(f => f.startsWith("ch") && f.endsWith(".jsx"));
  if (vizFiles.length > 0) {
    fs.mkdirSync(vizDst, { recursive: true });
    for (const vf of vizFiles) {
      const outName = vf.replace(".jsx", ".js");
      esbuild.buildSync({
        entryPoints: [path.join(vizSrc, vf)],
        outfile: path.join(vizDst, outName),
        bundle: true,
        minify: true,
        format: "esm",
        jsx: "automatic",
        jsxImportSource: "preact",
        target: ["es2020"],
        nodePaths: [path.join(SRC, "node_modules")],
      });
      vizBundles.add(outName.replace(".js", ""));
      console.log("  viz:", vf, "->", outName);
    }
  }
}

// Read our CSS
const appCss = fs.readFileSync(path.join(SRC, "style.css"), "utf-8");

// ── Parse all chapters ──
const chapterData = [];
for (const file of chapters) {
  const filePath = path.join(SRC, file);
  if (!fs.existsSync(filePath)) {
    console.warn("SKIP (not found):", file);
    continue;
  }
  const raw = fs.readFileSync(filePath, "utf-8");
  const html = md.render(raw);
  const slug = file.replace(/\.md$/, "").replace(/ /g, "-");
  const headingMatch = raw.match(/^#{1,2}\s+(.+)$/m);
  const title = headingMatch ? headingMatch[1] : slug;
  chapterData.push({ slug, title, html, file });
}

// ── Shared HTML shell ──
function buildSidebarHtml(activeSlug) {
  const items = chapterData
    .map((ch) => {
      const cls = ch.slug === activeSlug ? ' class="active"' : "";
      return '<li><a href="' + ch.slug + '.html"' + cls + ">" + ch.title + "</a></li>";
    })
    .join("\n");
  return items;
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

// Mermaid
import('https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs').then(m => {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  m.default.initialize({
    startOnLoad: false,
    theme: isDark ? 'dark' : 'default',
    securityLevel: 'loose',
  });
  m.default.run();
});
</script>`;

function buildPage({ pageTitle, sidebarActiveSlug, bodyContent, vizScript }) {
  const tocHtml = buildSidebarHtml(sidebarActiveSlug);
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${pageTitle}</title>
<style>${katexCss}</style>
<style>${appCss}</style>
<script>
(function(){var s=localStorage.getItem('theme');if(s==='dark'||(!s&&matchMedia('(prefers-color-scheme:dark)').matches))document.documentElement.setAttribute('data-theme','dark')})();
</script>
</head>
<body>

<button id="theme-toggle" aria-label="다크모드 전환">&#x1F319;</button>

<nav id="sidebar">
  <div class="sidebar-header">
    <h2><a href="index.html" style="color:inherit;text-decoration:none">목차</a></h2>
    <button id="sidebar-close" aria-label="사이드바 닫기">&times;</button>
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

// ── Generate per-chapter pages ──
for (let i = 0; i < chapterData.length; i++) {
  const ch = chapterData[i];
  const prev = i > 0 ? chapterData[i - 1] : null;
  const next = i < chapterData.length - 1 ? chapterData[i + 1] : null;

  let navHtml = '<nav class="chapter-nav">';
  if (prev) {
    navHtml += '<a class="chapter-nav-prev" href="' + prev.slug + '.html">&larr; ' + prev.title + "</a>";
  } else {
    navHtml += '<span></span>';
  }
  if (next) {
    navHtml += '<a class="chapter-nav-next" href="' + next.slug + '.html">' + next.title + " &rarr;</a>";
  } else {
    navHtml += '<span></span>';
  }
  navHtml += "</nav>";

  const bodyContent =
    '<section class="chapter">\n' + ch.html + "\n</section>\n" + navHtml;

  // Detect viz mount points and generate lazy-loader script
  let vizScript = '';
  const vizMatch = ch.html.match(/data-viz="([^"]+)"/g);
  if (vizMatch) {
    const vizIds = vizMatch.map(m => m.match(/data-viz="([^"]+)"/)[1]);
    const loaders = vizIds
      .filter(id => vizBundles.has(id))
      .map(id => `
    (function() {
      var el = document.querySelector('[data-viz="${id}"]');
      if (!el) return;
      var obs = new IntersectionObserver(function(entries) {
        if (entries[0].isIntersecting) {
          obs.disconnect();
          import('./viz/${id}.js').then(function(m) { m.mount(el); });
        }
      }, { rootMargin: '200px' });
      obs.observe(el);
    })();`);
    if (loaders.length > 0) {
      vizScript = '<script type="module">' + loaders.join('\n') + '\n</script>';
    }
  }

  const pageHtml = buildPage({
    pageTitle: ch.title + " — " + TITLE,
    sidebarActiveSlug: ch.slug,
    bodyContent,
    vizScript,
  });

  fs.writeFileSync(path.join(DIST, ch.slug + ".html"), pageHtml, "utf-8");
}

console.log(
  "Built " + chapterData.length + " chapter pages + index.html -> " + DIST
);
