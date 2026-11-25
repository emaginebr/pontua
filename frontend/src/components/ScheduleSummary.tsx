import { CalendarDays } from "lucide-react";
import { cn } from "../utils/cn";
import { summarizeSchedule } from "../utils/schedule";
import type { ScheduleShape } from "../utils/schedule";

export interface ScheduleSummaryProps {
  /** Jornada normalizada (`shapeFromInfo` / `shapeFromDraft`) */
  schedule: ScheduleShape;
  /** `card` = destaque `primary-soft` com `aria-live` (editor); `inline` = texto simples (listas) */
  variant?: "card" | "inline";
  className?: string;
}

/** Resumo da jornada: "Seg–Sex · 4 marcações · 44 h/semana" (components.md §6.1-7). */
export const ScheduleSummary = ({ schedule, variant = "inline", className }: ScheduleSummaryProps) => {
  const text = summarizeSchedule(schedule);
  if (variant === "inline") return <span className={cn("text-body-sm text-muted", className)}>{text}</span>;
  return (
    <p
      aria-live="polite"
      className={cn("flex items-center gap-2.5 rounded-control bg-primary-soft px-3.5 py-3 font-[650] text-text", className)}
    >
      <CalendarDays aria-hidden="true" className="size-5 shrink-0 text-primary" />
      {text}
    </p>
  );
};

export default ScheduleSummary;
