import { useTranslation } from "react-i18next";
import type { HoursSummary, SummaryTotals, WeekSummary } from "../types/summary";
import { cn } from "../utils/cn";
import { formatYmdRange } from "../utils/dateTime";
import { minutesToHhmm } from "../utils/duration";
import { durationSpeech } from "../utils/speech";
import { HoursBalance, WorkedOfExpected } from "./HoursBalance";

/** Três métricas: Trabalhado · Previsto · Saldo (components.md §3.4). */
export const TotalsGrid = ({ totals, className }: { totals: Pick<SummaryTotals, "workedMinutes" | "expectedMinutes" | "balanceMinutes">; className?: string }) => {
  const { t } = useTranslation();
  const metric = "flex min-w-0 flex-col gap-0.5 px-3 py-3.5";
  const label = "text-caption font-semibold text-muted";
  const value = "text-[1.375rem] leading-7 font-[750] tracking-tight tabular-nums text-text";
  return (
    <dl className={cn("grid grid-cols-3 divide-x divide-separator", className)}>
      <div className={metric}>
        <dt className={label}>{t("historico:summary.worked")}</dt>
        <dd className={value}>
          <span aria-hidden="true">{minutesToHhmm(totals.workedMinutes)}</span>
          <span className="sr-only">{durationSpeech(t, totals.workedMinutes)}</span>
        </dd>
      </div>
      <div className={metric}>
        <dt className={label}>{t("historico:summary.expected")}</dt>
        <dd className={value}>
          <span aria-hidden="true">{minutesToHhmm(totals.expectedMinutes)}</span>
          <span className="sr-only">{durationSpeech(t, totals.expectedMinutes)}</span>
        </dd>
      </div>
      <div className={metric}>
        <dt className={label}>{t("historico:summary.balance")}</dt>
        <dd>
          <HoursBalance minutes={totals.balanceMinutes} size="display" />
        </dd>
      </div>
    </dl>
  );
};

/** Lista de semanas: "17–23 nov · 35:12 / 44:00 · −08:48". */
export const WeekList = ({ weeks, today }: { weeks: WeekSummary[]; today: string }) => {
  const { t } = useTranslation();
  const ordered = [...weeks].sort((a, b) => b.from.localeCompare(a.from)).filter((week) => week.from <= today);
  return (
    <ol className="divide-y divide-separator">
      {ordered.map((week) => {
        const current = week.from <= today && today <= week.to;
        return (
          <li key={week.weekStart} className="flex min-h-touch items-center justify-between gap-2 px-4 py-2.5 text-body-sm">
            <span>
              {formatYmdRange(week.from, week.to)}
              {week.partial && <span className="sr-only"> {t("historico:summary.partial")}</span>}
            </span>
            <WorkedOfExpected worked={week.workedMinutes} expected={week.expectedMinutes} />
            {current ? (
              <span className="text-caption text-muted">{t("historico:day.inProgress")}</span>
            ) : (
              <HoursBalance minutes={week.balanceMinutes} />
            )}
          </li>
        );
      })}
    </ol>
  );
};

export interface SummaryHeaderProps {
  summary: HoursSummary;
  /** Hoje no fuso da empresa (semana corrente "em andamento") */
  today: string;
  /** Título do cartão (rótulo do período) */
  title: string;
  /** Mostra a lista de semanas aberta (computador) ou recolhida em "Semanas" (celular) */
  weeks?: "open" | "collapsed" | "hidden";
  className?: string;
}

/**
 * Totais do período e semanas (components.md §3.4, mockup history.html): no celular, cartão no
 * topo com as semanas recolhidas; no computador, coluna lateral fixa com as semanas abertas.
 */
export const SummaryHeader = ({ summary, today, title, weeks = "open", className }: SummaryHeaderProps) => {
  const { t } = useTranslation();
  const pending = summary.totals.pendingPunches;
  return (
    <section aria-label={t("historico:summary.label")} className={cn("flex flex-col gap-4", className)}>
      <div className="overflow-hidden rounded-card border border-separator bg-surface shadow-sm">
        <div className="flex items-center justify-between gap-2 border-b border-separator px-4 py-3">
          <h2 className="text-title-sm text-text">{title}</h2>
          <span className="text-caption text-muted">
            {formatYmdRange(summary.start, summary.end)}
          </span>
        </div>
        <TotalsGrid totals={summary.totals} />
        <p className="px-4 pb-3 text-caption text-muted">
          {t("historico:summary.pendingNote")}
          {pending > 0 && ` ${t("historico:summary.pendingCount", { count: pending })}`}
        </p>
        {weeks === "collapsed" && summary.weeks.length > 0 && (
          <details className="border-t border-separator">
            <summary className="flex min-h-touch cursor-pointer items-center px-4 text-body-sm font-semibold text-primary">
              {t("historico:summary.weeks")}
            </summary>
            <WeekList weeks={summary.weeks} today={today} />
          </details>
        )}
      </div>
      {weeks === "open" && summary.weeks.length > 0 && (
        <section
          aria-labelledby="semanas-titulo"
          className="overflow-hidden rounded-card border border-separator bg-surface shadow-sm"
        >
          <h2 id="semanas-titulo" className="border-b border-separator px-4 py-3 text-title-sm text-text">
            {t("historico:summary.weeks")}
          </h2>
          <WeekList weeks={summary.weeks} today={today} />
        </section>
      )}
    </section>
  );
};

export default SummaryHeader;
