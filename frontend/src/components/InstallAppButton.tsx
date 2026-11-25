import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Download, Share, SquarePlus, CircleCheck } from "lucide-react";
import { useInstallPrompt } from "../hooks/useInstallPrompt";
import { LOGO_SYMBOL_SRC } from "../utils/assets";
import { cn } from "../utils/cn";
import { notifySuccess } from "../utils/notify";
import { Button } from "./Button";
import { Modal, ModalBody, ModalClose, ModalContent, ModalFooter, ModalHeader, ModalTitle } from "./Modal";

export interface InstallAppButtonProps {
  /** `card` (/conta e /bem-vindo) · `nav` (menu lateral) · `item` (linha de lista em /conta) */
  variant?: "card" | "nav" | "item";
  className?: string;
}

const IOS_STEPS = [
  { key: "step1", icon: Share },
  { key: "step2", icon: SquarePlus },
  { key: "step3", icon: CircleCheck },
] as const;

/**
 * Instalar o app (components.md §9.5): prompt nativo quando há `beforeinstallprompt`; no iOS
 * abre a folha com o passo a passo. Instalado (standalone) → não renderiza.
 */
export const InstallAppButton = ({ variant = "card", className }: InstallAppButtonProps) => {
  const { t } = useTranslation();
  const install = useInstallPrompt();
  const [iosOpen, setIosOpen] = useState(false);

  const visible = variant === "card" ? install.showInvite : install.canInstall;
  if (!visible) return null;

  const start = async () => {
    if (install.canPromptNative) {
      const outcome = await install.promptInstall();
      if (outcome === "accepted") notifySuccess(t("pwa:install.installed"));
      return;
    }
    if (install.isIos) setIosOpen(true);
  };

  const iosSheet = (
    <Modal open={iosOpen} onOpenChange={setIosOpen}>
      <ModalContent aria-describedby={undefined}>
        <ModalHeader>
          <ModalTitle>{t("pwa:install.iosTitle")}</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <ol className="flex flex-col gap-3">
            {IOS_STEPS.map(({ key, icon: Icon }, index) => (
              <li key={key} className="flex items-start gap-3 text-body">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                <span className="pt-2">
                  <span className="sr-only">{`${index + 1}. `}</span>
                  <Trans i18nKey={`pwa:install.${key}`} components={{ strong: <strong className="font-bold" /> }} />
                </span>
              </li>
            ))}
          </ol>
        </ModalBody>
        <ModalFooter>
          <ModalClose asChild>
            <Button>{t("pwa:install.ok")}</Button>
          </ModalClose>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );

  if (variant === "nav") {
    return (
      <>
        <button
          type="button"
          onClick={() => void start()}
          className={cn(
            "flex min-h-touch w-full items-center gap-3 rounded-control px-3 text-body-sm font-semibold text-primary hover:bg-surface-2",
            className,
          )}
        >
          <Download aria-hidden="true" className="size-5" />
          {t("pwa:install.button")}
        </button>
        {iosSheet}
      </>
    );
  }

  if (variant === "item") {
    return (
      <>
        <Button
          variant="secondary"
          fullWidth
          icon={<Download aria-hidden="true" className="size-5" />}
          onClick={() => void start()}
          className={className}
        >
          {t("pwa:install.button")}
        </Button>
        {iosSheet}
      </>
    );
  }

  return (
    <section
      aria-labelledby="instalar-app-titulo"
      className={cn("flex items-start gap-3.5 rounded-card border border-separator bg-surface p-4 shadow-sm", className)}
    >
      <img src={LOGO_SYMBOL_SRC} alt="" width={40} height={40} className="size-10 shrink-0 object-contain" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div>
          <h2 id="instalar-app-titulo" className="text-title-sm text-text">
            {t("pwa:install.title")}
          </h2>
          <p className="text-body-sm text-muted">{t("pwa:install.text")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" icon={<Download aria-hidden="true" className="size-5" />} onClick={() => void start()}>
            {t("pwa:install.button")}
          </Button>
          <Button size="sm" variant="tertiary" onClick={install.dismiss}>
            {t("pwa:install.notNow")}
          </Button>
        </div>
      </div>
      {iosSheet}
    </section>
  );
};

export default InstallAppButton;
