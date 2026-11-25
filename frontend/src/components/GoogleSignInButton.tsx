import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { getGoogleClientId, loadGoogleScript } from "../utils/google";
import type { GoogleButtonConfiguration } from "../utils/google";
import { cn } from "../utils/cn";

export interface GoogleSignInButtonProps {
  /** Recebe o ID token do Google (enviar para `POST /api/auth/google`) */
  onCredential: (idToken: string) => void;
  /** Texto do botão oficial */
  text?: GoogleButtonConfiguration["text"];
  className?: string;
}

/**
 * Botão oficial "Continuar com Google" (research R-04): carrega o Google Identity Services sob
 * demanda e devolve o ID token. Não renderiza sem `VITE_GOOGLE_CLIENT_ID`.
 */
export const GoogleSignInButton = ({ onCredential, text = "continue_with", className }: GoogleSignInButtonProps) => {
  const { t } = useTranslation();
  const clientId = getGoogleClientId();
  const containerRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onCredential);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");

  useEffect(() => {
    callbackRef.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    if (!clientId) return undefined;
    let cancelled = false;
    loadGoogleScript()
      .then((google) => {
        const container = containerRef.current;
        if (cancelled || !container) return;
        google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => callbackRef.current(response.credential),
          ux_mode: "popup",
          cancel_on_tap_outside: true,
        });
        container.replaceChildren();
        google.accounts.id.renderButton(container, {
          type: "standard",
          theme: "outline",
          size: "large",
          shape: "rectangular",
          text,
          logo_alignment: "center",
          locale: "pt-BR",
          width: Math.min(400, Math.max(200, Math.round(container.clientWidth || 320))),
        });
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("failed");
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, text]);

  if (!clientId) return null;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div
        ref={containerRef}
        aria-busy={status === "loading" || undefined}
        className="flex min-h-control w-full items-center justify-center"
      />
      {status === "failed" && (
        <p role="status" className="text-center text-caption text-muted">
          {t("auth:google.unavailable")}
        </p>
      )}
    </div>
  );
};

export default GoogleSignInButton;
