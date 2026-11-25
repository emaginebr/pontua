import { forwardRef, useRef } from "react";
import type { ComponentPropsWithoutRef, ComponentRef, HTMLAttributes } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { cn } from "../utils/cn";

/**
 * Modal do app (skill `react-modal` sobre Radix Dialog; docs/design/components.md §8.1):
 * folha inferior abaixo de 1024 px e diálogo central a partir de 1024 px. Radix prende o foco,
 * fecha com `Esc`; `ModalContent` devolve o foco ao elemento que abriu o modal, mesmo sem
 * `ModalTrigger` (N-03). `ModalTitle` é obrigatório.
 */
const Modal = DialogPrimitive.Root;
const ModalTrigger = DialogPrimitive.Trigger;
const ModalPortal = DialogPrimitive.Portal;
const ModalClose = DialogPrimitive.Close;

const ModalOverlay = forwardRef<
  ComponentRef<typeof DialogPrimitive.Overlay>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn("fixed inset-0 z-(--z-overlay) bg-scrim animate-fade-in", className)}
    {...props}
  />
));
ModalOverlay.displayName = "ModalOverlay";

export type ModalSize = "md" | "lg";

export interface ModalContentProps extends ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  /** `md` 480 px (padrão) · `lg` 640 px (formulários de 2 colunas) */
  size?: ModalSize;
  /** Mostra o botão "Fechar" (X) no canto */
  showClose?: boolean;
}

/** Elemento que tinha o foco ao abrir (gatilho), se ainda puder receber o foco de volta. */
const focusableReturnTarget = (): HTMLElement | null => {
  const active = typeof document !== "undefined" ? document.activeElement : null;
  return active instanceof HTMLElement && active !== document.body ? active : null;
};

const DIALOG_SELECTOR = '[role="dialog"], [role="alertdialog"]';

/**
 * Último gatilho de fora de um modal. Serve de reserva quando um modal abre outro no lugar
 * (ex.: "⋯" → folha de ações → "Cancelar pedido" → confirmação): o botão dentro da primeira folha
 * some, e o foco deve voltar ao "⋯" que começou a sequência.
 */
let lastPageTrigger: HTMLElement | null = null;

interface ReturnFocus {
  primary: HTMLElement | null;
  fallback: HTMLElement | null;
}

const ModalContent = forwardRef<ComponentRef<typeof DialogPrimitive.Content>, ModalContentProps>(
  ({ className, children, size = "md", showClose = true, onOpenAutoFocus, onCloseAutoFocus, ...props }, ref) => {
    const { t } = useTranslation();
    /**
     * N-03 (WCAG 2.4.3, components.md §8.1): o Radix só devolve o foco a um `Dialog.Trigger`; os
     * modais do app abrem por estado (`open`), então guardamos o elemento ativo no instante em que
     * o diálogo monta (antes do foco entrar nele) e o devolvemos ao fechar (Esc, Cancelar, X ou
     * confirmar).
     */
    const returnFocusRef = useRef<ReturnFocus | null>(null);
    return (
      <ModalPortal>
        <ModalOverlay />
        <DialogPrimitive.Content
          ref={ref}
          className={cn(
            // Folha inferior (< 1024 px)
            "fixed inset-x-0 bottom-0 z-(--z-modal) flex max-h-[90dvh] flex-col overflow-y-auto",
            "rounded-t-sheet bg-surface text-text shadow-lg animate-sheet-in",
            "px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]",
            // Diálogo central (≥ 1024 px)
            "lg:inset-x-auto lg:bottom-auto lg:left-1/2 lg:top-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2",
            "lg:max-h-[85dvh] lg:rounded-xl lg:p-6 lg:animate-fade-in",
            size === "lg" ? "lg:w-[min(640px,calc(100vw-48px))]" : "lg:w-[min(480px,calc(100vw-48px))]",
            className,
          )}
          onOpenAutoFocus={(event) => {
            // Ainda no gatilho: o Radix dispara este evento antes de mover o foco para o diálogo
            const active = focusableReturnTarget();
            returnFocusRef.current = { primary: active, fallback: lastPageTrigger };
            if (active && !active.closest(DIALOG_SELECTOR)) lastPageTrigger = active;
            onOpenAutoFocus?.(event);
          }}
          onCloseAutoFocus={(event) => {
            onCloseAutoFocus?.(event);
            const saved = returnFocusRef.current;
            returnFocusRef.current = null;
            // O chamador pode decidir outro destino (`preventDefault`)
            const openDialog = document.querySelector(DIALOG_SELECTOR);
            // Fim da sequência de modais: a reserva não vale para o próximo modal
            if (!openDialog) lastPageTrigger = null;
            if (event.defaultPrevented || !saved) return;
            // A reserva só entra quando o gatilho estava dentro de outro modal (ou não havia foco)
            const fallback = !saved.primary || saved.primary.closest(DIALOG_SELECTOR) ? saved.fallback : null;
            const target = [saved.primary, fallback].find((element) => element?.isConnected) ?? null;
            // Gatilho removido da tela (ex.: linha que sumiu após a ação): comportamento padrão
            if (!target) return;
            event.preventDefault();
            // Outro modal abriu no lugar deste: ele fica com o foco (e devolve ao fechar)
            if (openDialog && !openDialog.contains(target)) return;
            target.focus({ preventScroll: true });
          }}
          {...props}
        >
          {/* Alça decorativa da folha */}
          <div aria-hidden="true" className="mx-auto mb-2 h-1 w-9 shrink-0 rounded-full bg-surface-3 lg:hidden" />
          {showClose && (
            <DialogPrimitive.Close
              className="absolute right-2 top-2 inline-grid size-touch place-items-center rounded-full text-muted hover:bg-surface-2 lg:right-3 lg:top-3"
              aria-label={t("comum:close")}
            >
              <X aria-hidden="true" className="size-5" />
            </DialogPrimitive.Close>
          )}
          {children}
        </DialogPrimitive.Content>
      </ModalPortal>
    );
  },
);
ModalContent.displayName = "ModalContent";

const ModalHeader = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("mb-4 flex flex-col gap-1 pr-12", className)} {...props} />
);
ModalHeader.displayName = "ModalHeader";

const ModalBody = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col gap-4", className)} {...props} />
);
ModalBody.displayName = "ModalBody";

/** Rodapé: botões empilhados em largura total no celular, lado a lado (confirmar à direita) ≥ 1024. */
const ModalFooter = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("mt-6 flex flex-col-reverse gap-2 lg:flex-row lg:justify-end [&>*]:w-full lg:[&>*]:w-auto", className)}
    {...props}
  />
);
ModalFooter.displayName = "ModalFooter";

const ModalTitle = forwardRef<
  ComponentRef<typeof DialogPrimitive.Title>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn("text-title text-text", className)} {...props} />
));
ModalTitle.displayName = "ModalTitle";

const ModalDescription = forwardRef<
  ComponentRef<typeof DialogPrimitive.Description>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("text-body-sm text-muted", className)} {...props} />
));
ModalDescription.displayName = "ModalDescription";

export {
  Modal,
  ModalPortal,
  ModalOverlay,
  ModalTrigger,
  ModalClose,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalTitle,
  ModalDescription,
};
