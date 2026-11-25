import { Toaster as SonnerToaster } from "sonner";
import { useTranslation } from "react-i18next";
import { CircleAlert, CircleCheck, Info, LoaderCircle, TriangleAlert } from "lucide-react";
import { useIsDesktop } from "../hooks/useMediaQuery";

/**
 * Região de toasts (skill `react-alert`; components.md §8.3): topo-centro no celular (não cobre
 * o botão de ponto nem a barra inferior), canto inferior direito ≥ 1024 px. O sonner anuncia
 * por `aria-live`; o rótulo da região vem do i18n.
 */
export const Toaster = () => {
  const { t } = useTranslation();
  const isDesktop = useIsDesktop();
  return (
    <SonnerToaster
      position={isDesktop ? "bottom-right" : "top-center"}
      closeButton
      visibleToasts={3}
      gap={8}
      containerAriaLabel={t("comum:toastRegion")}
      toastOptions={{ closeButtonAriaLabel: t("comum:close") }}
      icons={{
        success: <CircleCheck aria-hidden="true" className="size-5" />,
        error: <CircleAlert aria-hidden="true" className="size-5" />,
        warning: <TriangleAlert aria-hidden="true" className="size-5" />,
        info: <Info aria-hidden="true" className="size-5" />,
        loading: <LoaderCircle aria-hidden="true" className="size-5 animate-spin motion-reduce:animate-none" />,
      }}
    />
  );
};

export default Toaster;
