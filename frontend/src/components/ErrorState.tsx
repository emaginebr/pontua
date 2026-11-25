import { useTranslation } from "react-i18next";
import { RefreshCw, TriangleAlert } from "lucide-react";
import { cn } from "../utils/cn";
import { Button } from "./Button";

export interface ErrorStateProps {
  /** Título (padrão "Não foi possível carregar") */
  title?: string;
  /** Mensagem da API (padrão "Verifique sua conexão e tente de novo.") */
  message?: string | null;
  /** Ação "Tentar de novo" */
  onRetry?: () => void;
  /** Tentativa em andamento */
  retrying?: boolean;
  className?: string;
}

/** Erro de carregamento (components.md §10.3) com "Tentar de novo". */
export const ErrorState = ({ title, message, onRetry, retrying = false, className }: ErrorStateProps) => {
  const { t } = useTranslation();
  return (
    <div role="alert" className={cn("flex flex-col items-center gap-3 px-4 py-8 text-center", className)}>
      <span className="grid size-[72px] place-items-center rounded-full bg-danger-soft text-danger">
        <TriangleAlert aria-hidden="true" className="size-10" strokeWidth={1.75} />
      </span>
      <h2 className="text-title-sm text-text">{title ?? t("comum:loadErrorTitle")}</h2>
      <p className="max-w-prose text-body-sm text-muted">{message || t("comum:loadErrorDescription")}</p>
      {onRetry && (
        <Button
          variant="secondary"
          icon={<RefreshCw aria-hidden="true" className="size-5" />}
          loading={retrying}
          onClick={onRetry}
          className="mt-1"
        >
          {t("comum:retry")}
        </Button>
      )}
    </div>
  );
};

export default ErrorState;
