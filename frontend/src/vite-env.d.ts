/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />
/// <reference types="vite-plugin-pwa/info" />

interface ImportMetaEnv {
  /** URL base da API backend; vazio = mesma origem (proxy em dev, nginx em homolog) */
  readonly VITE_API_URL: string;
  /** Base path do React Router (opcional) */
  readonly VITE_SITE_BASENAME?: string;
  /** OAuth Client ID público do Google (opcional; sem ele o botão Google não aparece) */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  /** Somente dev: destino do proxy de /api e /health (lido pelo vite.config.ts) */
  readonly VITE_DEV_API_PROXY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
