import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { buttonClasses } from "./buttonStyles";
import type { ButtonSize, ButtonVariant } from "./buttonStyles";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  /** Estado "carregando": spinner no lugar do ícone, `aria-busy`, não reenvia */
  loading?: boolean;
  /** Texto exibido durante o carregamento ("Registrando…") */
  loadingText?: ReactNode;
  /** Ícone à esquerda (decorativo) */
  icon?: ReactNode;
}

/**
 * Botão do design (components.md §7.2). Variante `icon` exige `aria-label`. Foco visível vem
 * da base global (`:focus-visible`).
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      fullWidth = false,
      loading = false,
      loadingText,
      icon,
      className,
      children,
      type = "button",
      disabled,
      onClick,
      ...rest
    },
    ref,
  ) => (
    <button
      ref={ref}
      type={type}
      className={buttonClasses({ variant, size, fullWidth, className })}
      disabled={disabled}
      aria-busy={loading || undefined}
      onClick={(event) => {
        if (loading) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
      {...rest}
    >
      {loading ? (
        <LoaderCircle aria-hidden="true" className="size-5 shrink-0 animate-spin motion-reduce:animate-none" />
      ) : (
        icon
      )}
      {loading && loadingText !== undefined ? loadingText : children}
    </button>
  ),
);

Button.displayName = "Button";

export default Button;
