/** Script do Google Identity Services (research R-04). */
export const GOOGLE_GSI_SRC = "https://accounts.google.com/gsi/client";

/** Client ID público do Google (vazio = login Google desligado). */
export const getGoogleClientId = (): string => import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ?? "";

/** `true` quando há `VITE_GOOGLE_CLIENT_ID`. */
export const isGoogleSignInEnabled = (): boolean => getGoogleClientId().length > 0;

interface GoogleCredentialResponse {
  /** ID token (JWT) a enviar para `POST /api/auth/google` */
  credential: string;
}

interface GoogleIdConfiguration {
  client_id: string;
  callback: (response: GoogleCredentialResponse) => void;
  ux_mode?: "popup" | "redirect";
  cancel_on_tap_outside?: boolean;
}

/** Opções do botão oficial. */
export interface GoogleButtonConfiguration {
  type?: "standard" | "icon";
  theme?: "outline" | "filled_blue" | "filled_black";
  size?: "large" | "medium" | "small";
  text?: "signin_with" | "signup_with" | "continue_with" | "signin";
  shape?: "rectangular" | "pill" | "circle" | "square";
  logo_alignment?: "left" | "center";
  width?: number;
  locale?: string;
}

interface GoogleAccountsId {
  initialize: (config: GoogleIdConfiguration) => void;
  renderButton: (parent: HTMLElement, options: GoogleButtonConfiguration) => void;
}

/** Namespace `window.google` do GIS. */
export interface GoogleNamespace {
  accounts: { id: GoogleAccountsId };
}

declare global {
  interface Window {
    google?: GoogleNamespace;
  }
}

let scriptPromise: Promise<GoogleNamespace> | null = null;

/** Carrega o script do Google uma única vez, sob demanda. */
export const loadGoogleScript = (): Promise<GoogleNamespace> => {
  if (window.google?.accounts?.id) return Promise.resolve(window.google);
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<GoogleNamespace>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GOOGLE_GSI_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google?.accounts?.id) resolve(window.google);
      else reject(new Error("Google Identity Services indisponível"));
    };
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("Falha ao carregar o Google Identity Services"));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
};
