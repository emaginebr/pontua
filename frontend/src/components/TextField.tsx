import { forwardRef, useId, useState } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { CircleAlert, Eye, EyeOff } from "lucide-react";
import { cn } from "../utils/cn";
import { fieldInputClasses } from "./fieldStyles";

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: ReactNode;
  id?: string;
  /** Mensagem de erro do campo (liga `aria-invalid` + `aria-describedby`) */
  error?: string | null;
  /** Texto de ajuda abaixo do campo */
  help?: ReactNode;
  /** Mostra "(opcional)" no rótulo */
  optional?: boolean;
  /** Campo de senha com botão "Mostrar senha" */
  revealable?: boolean;
  /** Classe do contêiner */
  containerClassName?: string;
}

/**
 * Campo de texto (components.md §7.1): rótulo sempre visível, ajuda e erro ligados por
 * `aria-describedby`, `aria-invalid`, erro com ícone + texto (não só cor).
 */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  (
    { label, id, error, help, optional = false, revealable = false, containerClassName, className, type = "text", readOnly, ...rest },
    ref,
  ) => {
    const { t } = useTranslation();
    const generatedId = useId();
    const inputId = id ?? `campo-${generatedId}`;
    const helpId = `${inputId}-ajuda`;
    const errorId = `${inputId}-erro`;
    const [revealed, setRevealed] = useState(false);
    const hasError = Boolean(error);
    const describedBy = [help ? helpId : null, hasError ? errorId : null].filter(Boolean).join(" ") || undefined;
    const inputType = revealable ? (revealed ? "text" : "password") : type;

    return (
      <div className={cn("flex flex-col gap-1.5", containerClassName)}>
        <label htmlFor={inputId} className="text-label text-text">
          {label}
          {optional && <span className="font-medium text-muted"> {t("comum:optional")}</span>}
        </label>
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={inputType}
            readOnly={readOnly}
            aria-invalid={hasError || undefined}
            aria-describedby={describedBy}
            className={cn(fieldInputClasses(hasError, readOnly), revealable && "pr-12", className)}
            {...rest}
          />
          {revealable && (
            <button
              type="button"
              className="absolute right-0.5 top-0.5 inline-grid size-touch place-items-center rounded-full text-text hover:bg-surface-2"
              aria-label={revealed ? t("comum:hidePassword") : t("comum:showPassword")}
              aria-pressed={revealed}
              aria-controls={inputId}
              onClick={() => setRevealed((value) => !value)}
            >
              {revealed ? <EyeOff aria-hidden="true" className="size-5" /> : <Eye aria-hidden="true" className="size-5" />}
            </button>
          )}
        </div>
        {help && (
          <p id={helpId} className="text-caption text-muted">
            {help}
          </p>
        )}
        {hasError && (
          <p id={errorId} className="flex items-start gap-1.5 text-body-sm font-[550] text-danger">
            <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </p>
        )}
      </div>
    );
  },
);

TextField.displayName = "TextField";

export default TextField;
