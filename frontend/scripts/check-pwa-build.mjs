#!/usr/bin/env node
// Verifica o build PWA do Pontua (T068, research R-14). Rodar depois de `npm run build`:
//   npm run check:pwa
// Confere o manifest gerado (nome, cores, ícones any/maskable existentes e com o tamanho
// declarado, atalho "Registrar ponto"), o <link rel="manifest"> do index.html e o sw.js
// (fallback de navegação com denylist de /api/, /health e /swagger; precache enxuto).
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");
/** --pt-surface / --pt-bg (DESIGN_DIRECTION §8) */
const THEME_COLOR = "#ffffff";
const BACKGROUND_COLOR = "#f3f6f9";
/** Teto do precache (casca do app); acima disso algo pesado entrou por engano */
const MAX_PRECACHE_BYTES = 900 * 1024;

const errors = [];
const fail = (message) => errors.push(message);
const check = (condition, message) => {
  if (!condition) fail(message);
};

/** Lê largura × altura do cabeçalho IHDR de um PNG */
const pngSize = (file) => {
  const buffer = readFileSync(file);
  if (buffer.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") return null;
  return `${buffer.readUInt32BE(16)}x${buffer.readUInt32BE(20)}`;
};

/** Confere que `src` existe em dist/ e, se for PNG, que bate com `sizes` */
const checkAsset = (src, sizes, label) => {
  if (typeof src !== "string" || !src.startsWith("/")) {
    fail(`${label}: src inválido (${String(src)})`);
    return;
  }
  const file = join(DIST, src.replace(/^\//, "").split("?")[0]);
  if (!existsSync(file)) {
    fail(`${label}: arquivo ${src} não existe em dist/`);
    return;
  }
  if (sizes && file.toLowerCase().endsWith(".png")) {
    const actual = pngSize(file);
    check(actual === sizes, `${label}: ${src} tem ${actual ?? "formato inválido"}, esperado ${sizes}`);
  }
};

const readJson = (file) => {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (err) {
    fail(`${file}: não foi possível ler (${err instanceof Error ? err.message : String(err)})`);
    return null;
  }
};

if (!existsSync(DIST)) {
  console.error("dist/ não encontrado. Rode `npm run build` antes de `npm run check:pwa`.");
  process.exit(1);
}

// --- manifest.webmanifest -------------------------------------------------------

const manifestFile = join(DIST, "manifest.webmanifest");
const manifest = existsSync(manifestFile)
  ? readJson(manifestFile)
  : (fail("dist/manifest.webmanifest não existe"), null);

if (manifest) {
  const expected = {
    id: "/",
    name: "Pontua",
    short_name: "Pontua",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    lang: "pt-BR",
  };
  for (const [field, value] of Object.entries(expected)) {
    check(manifest[field] === value, `manifest.${field} = ${JSON.stringify(manifest[field])}, esperado ${JSON.stringify(value)}`);
  }
  check(typeof manifest.description === "string" && manifest.description.length > 0, "manifest.description vazio");
  check(String(manifest.theme_color).toLowerCase() === THEME_COLOR, `manifest.theme_color deve ser ${THEME_COLOR}`);
  check(
    String(manifest.background_color).toLowerCase() === BACKGROUND_COLOR,
    `manifest.background_color deve ser ${BACKGROUND_COLOR}`,
  );

  // Ícones: any 192/512 + maskable 192/512, todos existentes e com o tamanho declarado
  const icons = Array.isArray(manifest.icons) ? manifest.icons : [];
  for (const purpose of ["any", "maskable"]) {
    for (const size of ["192x192", "512x512"]) {
      const found = icons.some((icon) => icon.sizes === size && String(icon.purpose ?? "any").split(" ").includes(purpose));
      check(found, `manifest.icons sem ícone ${purpose} ${size}`);
    }
  }
  icons.forEach((icon, index) => checkAsset(icon.src, icon.sizes, `icons[${index}]`));

  // Atalho "Registrar ponto"
  const shortcuts = Array.isArray(manifest.shortcuts) ? manifest.shortcuts : [];
  const punch = shortcuts.find((item) => item.url === "/?acao=registrar");
  if (punch) {
    check(typeof punch.name === "string" && punch.name.length > 0, "atalho /?acao=registrar sem name");
    const shortcutIcons = Array.isArray(punch.icons) ? punch.icons : [];
    check(shortcutIcons.some((icon) => icon.sizes === "96x96"), "atalho /?acao=registrar sem ícone 96x96");
    shortcutIcons.forEach((icon, index) => checkAsset(icon.src, icon.sizes, `atalho icons[${index}]`));
  } else {
    fail("manifest.shortcuts sem o atalho /?acao=registrar");
  }
}

// --- index.html -----------------------------------------------------------------

const indexFile = join(DIST, "index.html");
if (existsSync(indexFile)) {
  const html = readFileSync(indexFile, "utf8");
  check(/<link[^>]+rel="manifest"[^>]+manifest\.webmanifest/.test(html), 'dist/index.html sem <link rel="manifest">');
  check((html.match(/rel="manifest"/g) ?? []).length === 1, 'dist/index.html deve ter um único <link rel="manifest">');
  check(/<html[^>]+lang="pt-BR"/.test(html), 'dist/index.html sem lang="pt-BR"');
  // Só o conteúdo do <meta name="viewport"> (o index.html tem um comentário citando os termos)
  const viewport = html.match(/<meta[^>]+name="viewport"[^>]+content="([^"]*)"/)?.[1];
  check(viewport !== undefined, 'dist/index.html sem <meta name="viewport">');
  check(
    !/user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(?![.\d])/.test(viewport ?? ""),
    "dist/index.html não pode bloquear o zoom (viewport)",
  );
} else {
  fail("dist/index.html não existe");
}

// --- sw.js ----------------------------------------------------------------------

const swFile = join(DIST, "sw.js");
if (existsSync(swFile)) {
  const sw = readFileSync(swFile, "utf8");
  for (const pattern of ["/^\\/api\\//", "/^\\/health/", "/^\\/swagger/"]) {
    check(sw.includes(pattern), `dist/sw.js sem ${pattern} no navigateFallbackDenylist`);
  }
  check(/NavigationRoute\([^)]*index\.html/.test(sw), "dist/sw.js sem o fallback de navegação para index.html");

  // Precache: entradas existentes, sem arquivos pesados que as telas não usam, dentro do teto
  const urls = [...sw.matchAll(/url:\s*"([^"]+)"/g)].map((match) => match[1]);
  check(urls.length > 0, "dist/sw.js sem entradas de precache");
  check(urls.includes("index.html"), "precache sem index.html");
  for (const banned of ["og-image.png", "logo.png", "logo-symbol.png"]) {
    check(!urls.includes(banned), `precache não deve incluir ${banned}`);
  }
  let total = 0;
  for (const url of urls) {
    const file = join(DIST, url);
    if (!existsSync(file)) {
      fail(`precache: ${url} não existe em dist/`);
      continue;
    }
    total += statSync(file).size;
  }
  check(
    total <= MAX_PRECACHE_BYTES,
    `precache com ${(total / 1024).toFixed(1)} KiB, acima do teto de ${MAX_PRECACHE_BYTES / 1024} KiB`,
  );
  if (errors.length === 0) {
    console.log(`precache: ${urls.length} arquivos, ${(total / 1024).toFixed(1)} KiB`);
  }
} else {
  fail("dist/sw.js não existe");
}

// --- Resultado ------------------------------------------------------------------

if (errors.length > 0) {
  console.error(`check:pwa falhou (${errors.length}):`);
  errors.forEach((message) => console.error(`  - ${message}`));
  process.exit(1);
}

console.log("check:pwa ok — manifest, ícones, atalho, index.html e sw.js conferidos.");
