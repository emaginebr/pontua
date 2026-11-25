import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "./Button";
import { Modal, ModalBody, ModalClose, ModalContent, ModalDescription, ModalFooter, ModalHeader, ModalTitle } from "./Modal";
import { TextField } from "./TextField";

export type ConfirmVariant = "primary" | "danger";

export interface ConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Ação confirmada; enquanto a promise corre o botão fica "carregando". Erro mantém o modal aberto. */
  onConfirm: () => void | Promise<void>;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  /** Texto do botão durante a ação ("Saindo…") */
  confirmLoadingLabel?: string;
  cancelLabel?: string;
  /** `danger` = ação destrutiva (foco inicial em Cancelar); `primary` = foco inicial em Confirmar */
  variant?: ConfirmVariant;
  /** Carregamento controlado pelo chamador (somado ao interno) */
  loading?: boolean;
  /** Botão de confirmar alto (56 px) — registro de ponto */
  largeConfirm?: boolean;
  /** Ícone decorativo à esquerda do texto de confirmar (`Check` no registro de ponto) */
  confirmIcon?: ReactNode;
  /** Avisos e conteúdo extra entre a descrição e os botões */
  children?: ReactNode;
  /**
   * Texto a digitar para liberar o botão (components.md §8.2 — transferência): comparação sem
   * diferenciar maiúsculas nem espaços nas pontas.
   */
  requireText?: string;
  /** Rótulo do campo de `requireText` ("Digite Carla Mendes para confirmar") */
  requireTextLabel?: ReactNode;
}

const normalize = (value: string): string => value.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");

/**
 * Confirmação (skill `react-modal`; docs/design/components.md §8.2) — substitui
 * `window.confirm()` em todo o app.
 */
export const ConfirmModal = ({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  confirmLabel,
  confirmLoadingLabel,
  cancelLabel,
  variant = "primary",
  loading = false,
  largeConfirm = false,
  confirmIcon,
  children,
  requireText,
  requireTextLabel,
}: ConfirmModalProps) => {
  const { t } = useTranslation();
  const [running, setRunning] = useState(false);
  const [typed, setTyped] = useState("");
  const [trackedOpen, setTrackedOpen] = useState(open);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const busy = running || loading;
  const textMatches = requireText === undefined || normalize(typed) === normalize(requireText);

  // Cada abertura começa com o campo de confirmação vazio
  if (trackedOpen !== open) {
    setTrackedOpen(open);
    if (open) setTyped("");
  }

  const handleConfirm = async () => {
    if (busy || !textMatches) return;
    setRunning(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch {
      // O chamador avisa o erro (toast); o modal continua aberto para tentar de novo
    } finally {
      setRunning(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={(next) => (!busy || next ? onOpenChange(next) : undefined)}>
      <ModalContent
        // Sem descrição: remove a referência (evita aviso do Radix e `aria-describedby` vazio)
        {...(description ? {} : { "aria-describedby": undefined })}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          (variant === "danger" ? cancelRef : confirmRef).current?.focus();
        }}
      >
        <ModalHeader>
          <ModalTitle>{title}</ModalTitle>
          {description && <ModalDescription>{description}</ModalDescription>}
        </ModalHeader>
        {(children || requireText !== undefined) && (
          <ModalBody>
            {children}
            {requireText !== undefined && (
              <TextField
                label={requireTextLabel ?? requireText}
                value={typed}
                autoComplete="off"
                disabled={busy}
                onChange={(event) => setTyped(event.target.value)}
              />
            )}
          </ModalBody>
        )}
        <ModalFooter>
          <ModalClose asChild>
            <Button ref={cancelRef} variant="secondary" disabled={busy}>
              {cancelLabel ?? t("comum:cancel")}
            </Button>
          </ModalClose>
          <Button
            ref={confirmRef}
            variant={variant === "danger" ? "danger" : "primary"}
            size={largeConfirm ? "lg" : "md"}
            loading={busy}
            loadingText={confirmLoadingLabel}
            disabled={!textMatches}
            icon={confirmIcon}
            onClick={() => void handleConfirm()}
          >
            {confirmLabel ?? t("comum:confirm")}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default ConfirmModal;
