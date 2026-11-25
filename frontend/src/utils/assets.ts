// Versões reduzidas (3× o maior tamanho exibido) geradas a partir de public/logo*.png: entram no
// build com hash em /assets/ e deixam o precache do PWA leve (T072). Os PNGs originais seguem em
// public/ (do ux-designer) para outros usos, fora do precache.
import logoUrl from "../assets/logo.webp";
import logoSymbolUrl from "../assets/logo-symbol.webp";

/** URL de um arquivo de `public/` respeitando o `base` do Vite. */
export const assetUrl = (name: string): string => `${import.meta.env.BASE_URL}${name.replace(/^\/+/, "")}`;

/** Logomarca completa (só sobre fundo claro) — 527×144 px. */
export const LOGO_SRC = logoUrl;
/**
 * Dimensões intrínsecas da logomarca: vão em `width`/`height` da `<img>` (com `h-* w-auto` no CSS)
 * para o navegador reservar a proporção antes de carregar (Lighthouse `unsized-images`, A-22).
 */
export const LOGO_WIDTH = 527;
export const LOGO_HEIGHT = 144;
/** Símbolo da logomarca — 128×128 px. */
export const LOGO_SYMBOL_SRC = logoSymbolUrl;
