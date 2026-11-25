import { cn } from "../utils/cn";
import { formatCounter } from "./navItems";

export interface PendingCounterProps {
  count: number;
  className?: string;
}

/**
 * Contador de pendências (components.md §1.1): pílula âmbar com número navy, `aria-hidden`
 * (o link traz o total em `sr-only` depois do rótulo: "Aprovações, 3 pendências"). Some quando 0.
 */
export const PendingCounter = ({ count, className }: PendingCounterProps) => {
  if (count <= 0) return null;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-grid h-5 min-w-5 place-items-center rounded-full border-2 border-surface bg-warning-solid px-1",
        "text-[0.75rem] leading-none font-bold text-brand-navy tabular",
        className,
      )}
    >
      {formatCounter(count)}
    </span>
  );
};

export default PendingCounter;
