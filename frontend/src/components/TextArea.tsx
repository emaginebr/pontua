import { forwardRef, useId } from "react";
import type { ReactNode, TextareaHTMLAttributes } from "react";
import { useTranslation } from "react-i18next";
import { CircleAlert } from "lucide-react";
import { cn } from "../utils/cn";
import { fieldInputClasses } from "./fieldStyles";

export interface TextAreaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id" | "value"> {
  label: ReactNode;
  id?: string;
  value: string;
  error?: string | null;
  help?: ReactNode;
  optional?: boolean;
  /** Mostra o contador "0/500" (usa `maxLength`) */
  showCounter?: boolean;
  containerClassName?: string;
}

/**
 * Área de texto (components.md §7.1) com rótulo, ajuda, erro e contador de caracteres, todos
 * ligados por `aria-describedby`.
 */
export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ label, id, value, error, help, optional = false, showCounter = false, containerClassName, className, maxLength, ...rest }, ref) => {
    const { t } = useTranslation();
    const generatedId = useId();
    const fieldId = id ?? `texto-${generatedId}`;
    const helpId = `${fieldId}-ajuda`;
    const errorId = `${fieldId}-erro`;
    const counterId = `${fieldId}-contador`;
    const hasError = Boolean(error);
    const counter = showCounter && maxLength !== undefined;
    const describedBy =
      [help ? helpId : null, hasError ? errorId : null, counter ? counterId : null].filter(Boolean).join(" ") || undefined;

    return (
      <div className={cn("flex flex-col gap-1.5", containerClassName)}>
        <label htmlFor={fieldId} className="text-label text-text">
          {label}
          {optional && <span className="font-medium text-muted"> {t("comum:optional")}</span>}
        </label>
        <textarea
          ref={ref}
          id={fieldId}
          value={value}
          maxLength={maxLength}
          aria-invalid={hasError || undefined}
          aria-describedby={describedBy}
          className={cn(fieldInputClasses(hasError), "min-h-24 resize-y", className)}
          {...rest}
        />
        {help && (
          <p id={helpId} className="text-caption text-muted">
            {help}
          </p>
        )}
        <div className="flex items-start justify-between gap-3">
          {hasError ? (
            <p id={errorId} className="flex items-start gap-1.5 text-body-sm font-[550] text-danger">
              <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </p>
          ) : (
            <span />
          )}
          {counter && (
            <span id={counterId} className="shrink-0 text-caption text-muted tabular-nums">
              <span aria-hidden="true">{t("comum:counter", { count: value.length, max: maxLength })}</span>
              <span className="sr-only">{t("comum:counterLabel", { count: value.length, max: maxLength })}</span>
            </span>
          )}
        </div>
      </div>
    );
  },
);

TextArea.displayName = "TextArea";

export default TextArea;
