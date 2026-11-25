import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../utils/cn";

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  /** Ação opcional (ex.: botão secundário) */
  action?: ReactNode;
  className?: string;
}

/** Vazio (components.md §10.2): ícone em círculo, título, texto e ação opcional. */
export const EmptyState = ({ icon: Icon, title, description, action, className }: EmptyStateProps) => (
  <div className={cn("flex flex-col items-center gap-3 px-4 py-8 text-center", className)}>
    <span className="grid size-[72px] place-items-center rounded-full bg-primary-soft text-primary">
      <Icon aria-hidden="true" className="size-10" strokeWidth={1.75} />
    </span>
    <h2 className="text-title-sm text-text">{title}</h2>
    {description && <p className="max-w-prose text-body-sm text-muted">{description}</p>}
    {action && <div className="mt-1">{action}</div>}
  </div>
);

export default EmptyState;
