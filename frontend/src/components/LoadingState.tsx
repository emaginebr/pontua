import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../utils/cn";

/** Atraso para mostrar o esqueleto (evita piscar em respostas rápidas). */
export const LOADING_SKELETON_DELAY_MS = 300;

export interface LoadingStateProps {
  /** Número de linhas do esqueleto */
  lines?: number;
  /** Texto para leitor de tela (padrão "Carregando…") */
  label?: string;
  className?: string;
}

/** Carregando (components.md §10.1): esqueleto após 300 ms, `aria-busy` e texto oculto. */
export const LoadingState = ({ lines = 3, label, className }: LoadingStateProps) => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), LOADING_SKELETON_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div role="status" aria-busy="true" className={cn("flex flex-col gap-3 py-4", className)}>
      <span className="sr-only">{label ?? t("comum:loading")}</span>
      {visible &&
        Array.from({ length: lines }, (_, index) => (
          <div
            key={index}
            aria-hidden="true"
            className={cn(
              "h-4 rounded-sm bg-surface-2 motion-safe:animate-pulse",
              index % 3 === 2 ? "w-2/3" : index % 2 === 1 ? "w-5/6" : "w-full",
            )}
          />
        ))}
    </div>
  );
};

export default LoadingState;
