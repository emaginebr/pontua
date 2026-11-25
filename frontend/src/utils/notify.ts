/**
 * Toasts (skill `react-alert`, sonner) com as durações de docs/design/components.md §8.3:
 * sucesso/info 4 s, aviso 6 s, erro até fechar. Nunca `alert()`.
 */
import { createElement } from "react";
import { CloudOff } from "lucide-react";
import { toast } from "sonner";

export const TOAST_DURATION_MS = 4_000;
export const TOAST_WARNING_DURATION_MS = 6_000;

/** Classe do tipo "offline" (faixa e ícone `offline` em index.css). */
export const OFFLINE_TOAST_CLASS = "pt-toast-offline";

export const notifySuccess = (message: string, description?: string): void => {
  toast.success(message, { description, duration: TOAST_DURATION_MS });
};

export const notifyInfo = (message: string, description?: string): void => {
  toast.info(message, { description, duration: TOAST_DURATION_MS });
};

/** Marcação guardada sem conexão: ícone `CloudOff` e faixa `offline` (components.md §8.3, I-04). */
export const notifyOffline = (message: string, description?: string): void => {
  toast(message, {
    description,
    duration: TOAST_DURATION_MS,
    className: OFFLINE_TOAST_CLASS,
    icon: createElement(CloudOff, { "aria-hidden": true, className: "size-5" }),
  });
};

export const notifyWarning = (message: string, description?: string): void => {
  toast.warning(message, { description, duration: TOAST_WARNING_DURATION_MS });
};

export const notifyError = (message: string, description?: string): void => {
  toast.error(message, { description, duration: Number.POSITIVE_INFINITY });
};
