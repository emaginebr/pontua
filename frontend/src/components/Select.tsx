import { forwardRef, useId } from "react";
import type { ReactNode, SelectHTMLAttributes } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, CircleAlert } from "lucide-react";
import { cn } from "../utils/cn";
import { fieldInputClasses } from "./fieldStyles";

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> {
  label: ReactNode;
  id?: string;
  error?: string | null;
  help?: ReactNode;
  optional?: boolean;
  containerClassName?: string;
  children: ReactNode;
}

/** Lista de opções nativa com rótulo, ajuda e erro ligados (components.md §7.1). */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, id, error, help, optional = false, containerClassName, className, children, ...rest }, ref) => {
    const { t } = useTranslation();
    const generatedId = useId();
    const selectId = id ?? `lista-${generatedId}`;
    const helpId = `${selectId}-ajuda`;
    const errorId = `${selectId}-erro`;
    const hasError = Boolean(error);
    const describedBy = [help ? helpId : null, hasError ? errorId : null].filter(Boolean).join(" ") || undefined;

    return (
      <div className={cn("flex flex-col gap-1.5", containerClassName)}>
        <label htmlFor={selectId} className="text-label text-text">
          {label}
          {optional && <span className="font-medium text-muted"> {t("comum:optional")}</span>}
        </label>
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            aria-invalid={hasError || undefined}
            aria-describedby={describedBy}
            className={cn(fieldInputClasses(hasError), "appearance-none pr-11", className)}
            {...rest}
          >
            {children}
          </select>
          <ChevronDown
            aria-hidden="true"
            className="pointer-events-none absolute right-3.5 top-1/2 size-5 -translate-y-1/2 text-muted"
          />
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

Select.displayName = "Select";

export default Select;
