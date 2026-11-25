import { useTranslation } from "react-i18next";
import { CircleCheck, CloudOff } from "lucide-react";
import { useConnectivity } from "../hooks/useConnectivity";

/**
 * Faixa "Sem conexão" após 2 s offline (components.md §9.1, research R-08); ao reconectar vira
 * "Conexão restabelecida" por 3 s. `role="status"` (anunciada sem roubar o foco).
 */
export const OfflineBanner = () => {
  const { t } = useTranslation();
  const { showBanner, justReconnected } = useConnectivity();

  return (
    <div role="status" className="empty:hidden">
      {showBanner && (
        <div className="flex min-h-touch items-center gap-2.5 bg-banner-offline px-4 py-2 text-body-sm text-white">
          <CloudOff aria-hidden="true" className="size-5 shrink-0" />
          <p>
            <strong className="font-bold">{t("pwa:offline.bannerStrong")}</strong> {t("pwa:offline.bannerText")}
          </p>
        </div>
      )}
      {!showBanner && justReconnected && (
        <div className="flex min-h-touch items-center gap-2.5 bg-success-soft px-4 py-2 text-body-sm font-semibold text-success">
          <CircleCheck aria-hidden="true" className="size-5 shrink-0" />
          <p>{t("pwa:offline.reconnected")}</p>
        </div>
      )}
    </div>
  );
};

export default OfflineBanner;
