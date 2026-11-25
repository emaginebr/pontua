import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRegisterSW } from "virtual:pwa-register/react";
import { RefreshCw } from "lucide-react";
import { notifyError } from "../utils/notify";
import { Button } from "./Button";

/** Intervalo da busca por versão nova do app. */
export const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

/**
 * "Nova versão disponível — Atualizar" (research R-14, components.md §9.4). Registra o service
 * worker (`registerType: "prompt"`, `injectRegister: false`): renderizar uma única vez, em
 * `App.tsx`. `role="status"`, não rouba o foco. Em `npm run dev` não há SW.
 */
export const UpdatePrompt = () => {
  const { t } = useTranslation();
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [updating, setUpdating] = useState(false);
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW: (_url, swRegistration) => {
      if (swRegistration) setRegistration(swRegistration);
    },
  });

  // Procura versão nova de hora em hora e quando a aba volta a ficar visível
  useEffect(() => {
    if (!registration) return undefined;
    const check = () => {
      if (registration.installing || navigator.onLine === false) return;
      registration.update().catch(() => undefined);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") check();
    };
    const interval = setInterval(check, UPDATE_CHECK_INTERVAL_MS);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [registration]);

  if (!needRefresh) return null;

  const update = async () => {
    setUpdating(true);
    try {
      await updateServiceWorker(true);
    } catch {
      setUpdating(false);
      notifyError(t("pwa:update.failed"));
    }
  };

  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-[calc(var(--pt-tabbar-h)+env(safe-area-inset-bottom)+12px)] z-(--z-banner) mx-auto flex max-w-[420px] flex-wrap items-center gap-3 rounded-lg border border-separator bg-surface p-3 shadow-lg lg:inset-x-auto lg:bottom-6 lg:left-[calc(var(--pt-sidebar-w)+24px)] lg:mx-0"
    >
      <RefreshCw aria-hidden="true" className="size-5 shrink-0 text-primary" />
      <p className="min-w-0 flex-1 text-body-sm font-semibold text-text">{t("pwa:update.title")}</p>
      <div className="flex gap-2">
        <Button size="sm" variant="tertiary" onClick={() => setNeedRefresh(false)} disabled={updating}>
          {t("pwa:update.later")}
        </Button>
        <Button size="sm" loading={updating} loadingText={t("pwa:update.updating")} onClick={() => void update()}>
          {t("pwa:update.update")}
        </Button>
      </div>
    </div>
  );
};

export default UpdatePrompt;
