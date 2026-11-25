import { forwardRef } from "react";
import type { HTMLAttributes, ReactNode } from "react";
import { CircleAlert, CircleCheck, CloudOff, Info, TriangleAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../utils/cn";

export type NoticeVariant = "info" | "warning" | "danger" | "offline" | "success";

const STYLES: Record<NoticeVariant, { box: string; icon: LucideIcon }> = {
  info: { box: "bg-primary-soft text-text [&_svg]:text-primary", icon: Info },
  warning: { box: "bg-warning-soft text-text [&_svg]:text-warning", icon: TriangleAlert },
  danger: { box: "bg-danger-soft text-text [&_svg]:text-danger", icon: CircleAlert },
  offline: { box: "bg-offline-soft text-text [&_svg]:text-offline", icon: CloudOff },
  success: { box: "bg-success-soft text-text [&_svg]:text-success", icon: CircleCheck },
};

export interface NoticeProps extends HTMLAttributes<HTMLDivElement> {
  variant?: NoticeVariant;
  /** Ícone no lugar do padrão da variante */
  icon?: LucideIcon;
  children: ReactNode;
}

/** Aviso inline (components.md §7.3). Padrão `role="status"`; use `role="alert"` em erro de envio. */
export const Notice = forwardRef<HTMLDivElement, NoticeProps>(
  ({ variant = "info", icon, className, children, role = "status", ...rest }, ref) => {
    const style = STYLES[variant];
    const Icon = icon ?? style.icon;
    return (
      <div
        ref={ref}
        role={role}
        className={cn("flex items-start gap-2.5 rounded-control px-3.5 py-3 text-body-sm", style.box, className)}
        {...rest}
      >
        <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    );
  },
);

Notice.displayName = "Notice";

export default Notice;
