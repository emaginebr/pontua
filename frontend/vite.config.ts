import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

/** `--pt-surface` (barras superior/inferior brancas) — docs/design/DESIGN_DIRECTION.md §8 */
const THEME_COLOR = "#FFFFFF";
/** `--pt-bg` (splash sem "piscar" ao abrir) — docs/design/DESIGN_DIRECTION.md §8 */
const BACKGROUND_COLOR = "#F3F6F9";

/** API de homolog (research R-15); sobrescrevível por VITE_DEV_API_PROXY */
const DEFAULT_DEV_API_PROXY = "http://localhost:5080";

// https://vite.dev/config/ — o bloco `test` é lido pelo Vitest
export default defineConfig(({ mode }) => {
  // Lê VITE_DEV_API_PROXY tanto do ambiente do processo quanto de .env/.env.local
  const env = { ...loadEnv(mode, process.cwd(), "VITE_"), ...process.env };
  const devApiProxy = env.VITE_DEV_API_PROXY || DEFAULT_DEV_API_PROXY;

  return {
    plugins: [
      react(),
      tailwindcss(),
      // research R-14: SW com precache só da casca; registro feito pelo app
      // (`virtual:pwa-register/react` no aviso "Nova versão disponível"); em dev não há SW.
      VitePWA({
        registerType: "prompt",
        injectRegister: false,
        strategies: "generateSW",
        devOptions: { enabled: false },
        // Os PNGs de `public/` já entram pelo `globPatterns` (evita entradas duplicadas)
        includeManifestIcons: false,
        workbox: {
          // Casca: JS/CSS (traduções vão no JS), HTML, fontes e ícones
          globPatterns: ["**/*.{js,css,html,svg,png,ico,webp,woff2}"],
          globIgnores: [
            "**/node_modules/**/*",
            // Imagem de compartilhamento só serve para crawlers
            "og-image.png",
            // As telas usam as versões reduzidas de src/assets/ (logo*.webp, com hash em /assets/)
            "logo.png",
            "logo-symbol.png",
            // Ícones que o navegador/SO baixa sozinho na instalação (com rede); o app não os exibe
            "icon-any-512.png",
            "icon-maskable-512.png",
            "apple-touch-icon.png",
            "favicon.ico",
            "favicon-32.png",
            // Subconjunto vietnamita da fonte: nenhum texto do app usa (pt-BR cabe em latin/latin-ext)
            "assets/*-vietnamese-*.woff2",
          ],
          navigateFallback: "/index.html",
          // Rotas do backend na mesma origem nunca são servidas pelo SW
          navigateFallbackDenylist: [/^\/api\//, /^\/health/, /^\/swagger/],
          cleanupOutdatedCaches: true,
        },
        manifest: {
          id: "/",
          name: "Pontua",
          short_name: "Pontua",
          // Texto do manifest definido pelo design (DESIGN_DIRECTION §8)
          description: "Registre seu ponto e acompanhe suas horas.",
          lang: "pt-BR",
          dir: "ltr",
          start_url: "/?source=pwa",
          scope: "/",
          display: "standalone",
          display_override: ["standalone"],
          orientation: "portrait",
          theme_color: THEME_COLOR,
          background_color: BACKGROUND_COLOR,
          categories: ["business", "productivity"],
          // Ícones gerados pelo ux-designer (T005)
          icons: [
            { src: "/icon-any-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
            { src: "/icon-any-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
            { src: "/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
            { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          ],
          shortcuts: [
            {
              name: "Registrar ponto",
              short_name: "Registrar",
              description: "Abrir o app pronto para registrar o ponto",
              url: "/?acao=registrar",
              icons: [{ src: "/shortcut-punch-96.png", sizes: "96x96", type: "image/png" }],
            },
          ],
        },
      }),
    ],
    server: {
      port: 5173,
      // research R-15: em dev a API fica na mesma origem via proxy
      proxy: {
        "/api": { target: devApiProxy, changeOrigin: true },
        "/health": { target: devApiProxy, changeOrigin: true },
      },
    },
    test: {
      environment: "jsdom",
      setupFiles: "./src/test/setup.ts",
      globals: true,
      css: false,
      testTimeout: 15000,
    },
  };
});
