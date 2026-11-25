import { cn } from "../utils/cn";

/** Variantes de botão (docs/design/components.md §7.2). */
export type ButtonVariant =
  | "primary"
  | "secondary"
  | "tertiary"
  | "danger"
  | "danger-ghost"
  | "success"
  | "reject"
  | "google"
  | "icon";

/** `sm` 44 px (listas densas), `md` 48 px (padrão), `lg` 56 px (confirmar ponto). */
export type ButtonSize = "sm" | "md" | "lg";

/**
 * A cor da borda NÃO fica na base: `cn` só concatena (não resolve conflito) e, na CSS gerada,
 * `border-transparent` venceria `border-border`/`border-danger` das variantes com contorno
 * (revisão T070, I-16). Cada variante declara a própria cor de borda.
 */
const BASE =
  "inline-flex items-center justify-center gap-2 rounded-control border text-center text-button " +
  "no-underline select-none transition-[background-color,box-shadow,transform] duration-(--pt-duration-fast) " +
  "active:scale-[0.98] motion-reduce:active:scale-100 " +
  "disabled:cursor-not-allowed disabled:border-transparent disabled:text-disabled " +
  "disabled:shadow-none disabled:active:scale-100 " +
  "aria-disabled:cursor-not-allowed aria-disabled:border-transparent " +
  "aria-disabled:text-disabled aria-disabled:active:scale-100";

/** Fundo do desabilitado — todas as variantes menos `icon` (components.md §0). */
const DISABLED_FILL = "disabled:bg-surface-2 aria-disabled:bg-surface-2";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "border-transparent bg-primary text-on-primary hover:bg-primary-hover active:bg-primary-pressed",
  secondary: "border-border bg-surface text-primary hover:bg-surface-2 active:bg-surface-3",
  tertiary: "border-transparent bg-transparent text-primary hover:underline active:bg-surface-2",
  danger: "border-transparent bg-danger text-white hover:bg-danger-hover",
  "danger-ghost": "border-transparent bg-transparent text-danger hover:underline active:bg-danger-soft",
  success: "border-transparent bg-success-solid text-white hover:brightness-95",
  /** Contorno vermelho (Rejeitar, Transferir — components.md §5.2) */
  reject: "border-danger bg-surface text-danger hover:bg-danger-soft",
  google: "border-border bg-surface text-text hover:bg-surface-2 active:bg-surface-3",
  /** Desabilitado sem fundo — um círculo cinza parece "selecionado" (components.md §0, A-09) */
  icon:
    // Sem cor de texto própria: herda do contexto (preflight `color: inherit`), para um
    // className como `text-danger` não entrar em conflito com a variante
    "rounded-full border-transparent bg-transparent hover:bg-surface-2 active:bg-surface-3 " +
    "disabled:hover:bg-transparent disabled:active:bg-transparent " +
    "aria-disabled:hover:bg-transparent aria-disabled:active:bg-transparent",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "min-h-control-sm px-3.5 text-[0.9375rem]",
  md: "min-h-control px-[18px]",
  lg: "min-h-14 px-5 text-[1.0625rem]",
};

/** Opções de estilo de botão. */
export interface ButtonStyleOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
}

/** Classes de botão — também usadas em `<Link>` com aparência de botão. */
export const buttonClasses = ({ variant = "primary", size = "md", fullWidth = false, className }: ButtonStyleOptions = {}): string =>
  cn(
    BASE,
    VARIANTS[variant],
    variant !== "icon" && DISABLED_FILL,
    variant === "icon" ? "size-touch min-h-touch min-w-touch p-0" : SIZES[size],
    (variant === "tertiary" || variant === "danger-ghost") && "px-3",
    fullWidth && "w-full",
    className,
  );
