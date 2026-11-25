import { useId, useState } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { CalendarX, ChevronDown, Hourglass, Plus, TriangleAlert } from "lucide-react";
import { useIsDesktop } from "../hooks/useMediaQuery";
import type { DayRecord, PunchInfo } from "../types/punch";
import { cn } from "../utils/cn";
import { formatDateTimeShortInZone, formatYmdShort } from "../utils/dateTime";
import { actionPunchOf, buildDayRows, daysOffLabel, isMissingDay, isStruckPunch } from "../utils/dayRows";
import type { DayRow } from "../utils/dayRows";
import { Button } from "./Button";
import { CorrectionPair } from "./CorrectionPair";
import { HoursBalance, WorkedOfExpected } from "./HoursBalance";
import { PunchBadge } from "./PunchBadge";

export interface DayCardProps {
  day: DayRecord;
  /** Hoje no fuso da empresa */
  today: string;
  timeZone: string;
  /** "Incluir marcação" no rodapé (só quando a data está dentro do limite) */
  onInclude?: (date: string) => void;
  /** Ações indisponíveis (sem conexão) */
  actionsDisabled?: boolean;
  /** Ação de uma marcação (menu "Mais ações" ou link de detalhe); `name` = nome da linha ("Saída", "Extra") */
  renderPunchAction?: (punch: PunchInfo, name: string) => ReactNode;
  /** Abre (ou não) o cartão no celular; padrão: hoje, com pendência ou dia útil sem marcação */
  defaultExpanded?: boolean;
}

const dotClass = (punch: PunchInfo | null): string => {
  switch (punch?.status) {
    case "valid":
    case "approved":
      return "border-success bg-success";
    case "pending":
      return "border-warning bg-warning-solid";
    case "rejected":
      return "border-danger bg-danger";
    case "cancelled":
    case "superseded":
      return "border-neutral bg-neutral-soft";
    default:
      return "border-border bg-surface";
  }
};

const Tag = ({ icon, tone, children }: { icon?: ReactNode; tone: "danger" | "warning" | "primary"; children: ReactNode }) => (
  <span
    className={cn(
      "inline-flex h-6 items-center gap-1 self-start rounded-sm px-2 text-caption font-semibold whitespace-nowrap",
      tone === "danger" && "bg-danger-soft text-danger",
      tone === "warning" && "bg-warning-soft text-warning",
      tone === "primary" && "bg-primary-soft text-primary",
    )}
  >
    {icon}
    {children}
  </span>
);

/**
 * Dia do histórico (components.md §3.3, mockup history.html): cabeçalho com data, horas e saldo
 * (expande/recolhe no celular, sempre aberto ≥ 1024 px), períodos previstos com a marcação de cada
 * um, extras, pedidos de correção com a original **lado a lado**, e "Incluir marcação".
 */
export const DayCard = ({
  day,
  today,
  timeZone,
  onInclude,
  actionsDisabled = false,
  renderPunchAction,
  defaultExpanded,
}: DayCardProps) => {
  const { t } = useTranslation();
  const isDesktop = useIsDesktop();
  const bodyId = useId();
  const isToday = day.date === today;
  const missing = isMissingDay(day, today);
  const pendingCount = day.punches.filter((punch) => punch.status === "pending").length;
  // < 1024 px: abertos por padrão só hoje, dias com pendência e dias úteis sem marcação (I-09)
  const [expanded, setExpanded] = useState(() => defaultExpanded ?? (isToday || pendingCount > 0 || missing));
  const open = isDesktop || expanded;
  const incomplete = !missing && day.incomplete && day.isWorkDay && day.date < today;
  const rows = buildDayRows(day);
  const dateLabel = formatYmdShort(day.date);

  const rowName = (row: DayRow): string => row.name ?? t("ponto:extra");

  const reviewLine = (punch: PunchInfo): string | null => {
    if (!punch.review || (punch.status !== "approved" && punch.status !== "rejected")) return null;
    const { date, time } = formatDateTimeShortInZone(punch.review.at, timeZone);
    const base = t("historico:day.reviewed", { by: punch.review.by, date, time });
    return punch.review.note ? `${base} · ${t("historico:day.reviewNote", { note: punch.review.note })}` : base;
  };

  const justification = (punch: PunchInfo) =>
    punch.justification ? (
      <p className="mt-1.5 rounded-sm bg-surface-2 px-2.5 py-2 text-body-sm text-text">
        <span className="sr-only">{t("historico:day.justification")}: </span>“{punch.justification}”
      </p>
    ) : null;

  const reviewText = (punch: PunchInfo) => {
    const text = reviewLine(punch);
    return text ? <span className="mt-1 block text-caption text-muted">{text}</span> : null;
  };

  const header = (
    <>
      <span className="flex min-w-0 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              "text-[1.0625rem]",
              !day.isWorkDay && day.punches.length === 0 ? "font-semibold text-muted" : "font-bold",
            )}
          >
            {dateLabel}
          </span>
          {isToday && <Tag tone="primary">{t("historico:day.today")}</Tag>}
        </span>
        {missing && (
          <Tag tone="danger" icon={<CalendarX aria-hidden="true" className="size-3.5" />}>
            {t("historico:day.missing")}
          </Tag>
        )}
        {incomplete && (
          <Tag tone="warning" icon={<TriangleAlert aria-hidden="true" className="size-3.5" />}>
            {t("historico:day.incomplete")}
          </Tag>
        )}
        {pendingCount > 0 && (
          <Tag tone="warning" icon={<Hourglass aria-hidden="true" className="size-3.5" />}>
            {t("historico:day.pending", { count: pendingCount })}
          </Tag>
        )}
      </span>
      <span className="ml-auto flex flex-col items-end text-right text-body-sm">
        {day.isWorkDay || day.workedMinutes > 0 ? (
          <>
            <WorkedOfExpected worked={day.workedMinutes} expected={day.expectedMinutes} />
            {isToday ? (
              <span className="text-caption text-muted">{t("historico:day.inProgress")}</span>
            ) : (
              <HoursBalance minutes={day.balanceMinutes} />
            )}
          </>
        ) : (
          <span className="text-muted">{t("historico:day.dayOff")}</span>
        )}
      </span>
    </>
  );

  return (
    <article
      aria-label={dateLabel}
      className={cn(
        "overflow-hidden rounded-card border border-separator bg-surface shadow-sm",
        missing && "shadow-[inset_4px_0_0_var(--pt-danger)]",
      )}
    >
      <h2 className="text-body text-text">
        {isDesktop ? (
          <span className="flex min-h-14 items-center gap-2.5 py-2.5 pr-4 pl-4">{header}</span>
        ) : (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={() => setExpanded((value) => !value)}
            className="flex min-h-14 w-full items-center gap-2.5 py-2.5 pr-3.5 pl-4 text-left"
          >
            {header}
            <ChevronDown
              aria-hidden="true"
              className={cn("size-4 shrink-0 text-muted transition-transform", open && "rotate-180")}
            />
          </button>
        )}
      </h2>

      {open && (
        <div id={bodyId}>
          <div className="border-t border-separator">
            {rows.length === 0 ? (
              <p className="px-4 pt-3 pb-2 text-body-sm text-muted">
                {missing ? t("historico:day.missingText") : t("historico:day.noPunches")}
              </p>
            ) : (
              <ol className="divide-y divide-separator">
                {rows.map((row) => {
                  const punch = row.punch;
                  const hasCorrections = row.corrections.length > 0;
                  const actionPunch = actionPunchOf(row);
                  const meta =
                    punch?.pendingReason === "outsideWorkday"
                      ? t("ponto:today.outsideWorkday")
                      : row.expectedTime
                        ? t("ponto:today.expected", { time: row.expectedTime })
                        : null;
                  const singleBadge = !hasCorrections && punch ? (
                    <PunchBadge punch={punch} showExtra={!row.isPeriod} />
                  ) : null;
                  // Grade (I-07): linha 1 = marcador · nome · horário · ⋯; o resto ocupa a largura toda
                  return (
                    <li
                      key={row.key}
                      className={cn(
                        "grid items-center gap-x-3 py-2.5 pl-4",
                        renderPunchAction
                          ? "grid-cols-[12px_minmax(0,1fr)_auto_44px] pr-2"
                          : "grid-cols-[12px_minmax(0,1fr)_auto] pr-4",
                      )}
                    >
                      <span aria-hidden="true" className={cn("size-3 rounded-full border-2", dotClass(punch))} />
                      <span className="min-w-0">
                        <span className="block font-[650] break-words text-text">{rowName(row)}</span>
                        {meta && <span className="block text-caption font-medium text-muted">{meta}</span>}
                      </span>
                      {hasCorrections ? (
                        <span aria-hidden="true" />
                      ) : punch ? (
                        <span
                          className={cn(
                            "text-right text-[1.0625rem] font-bold tabular-nums",
                            isStruckPunch(punch) && "text-muted line-through",
                          )}
                        >
                          {punch.localTime}
                        </span>
                      ) : (
                        <span className="text-right text-[1.0625rem] font-bold text-subtle">
                          <span aria-hidden="true">—</span>
                          <span className="sr-only">{t("historico:day.notPunched")}</span>
                        </span>
                      )}
                      {renderPunchAction &&
                        (actionPunch ? (
                          <span className="justify-self-end">{renderPunchAction(actionPunch, rowName(row))}</span>
                        ) : (
                          <span aria-hidden="true" />
                        ))}

                      {(singleBadge || hasCorrections || (punch && (punch.justification || reviewLine(punch)))) && (
                        <div className="col-[2/-1] min-w-0">
                          {singleBadge && <div className="mt-1">{singleBadge}</div>}
                          {hasCorrections && punch && (
                            <CorrectionPair
                              className="mt-1.5"
                              original={punch}
                              corrections={row.corrections}
                              renderDetails={(correction) => (
                                <>
                                  {justification(correction)}
                                  {reviewText(correction)}
                                </>
                              )}
                            />
                          )}
                          {punch && !hasCorrections && justification(punch)}
                          {punch && !hasCorrections && reviewText(punch)}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
          {onInclude && (
            <div className="flex flex-wrap gap-1 border-t border-separator px-2 py-1.5">
              <Button
                variant={missing ? "secondary" : "tertiary"}
                size="sm"
                disabled={actionsDisabled}
                onClick={() => onInclude(day.date)}
                aria-label={t("historico:includeOn", { date: dateLabel })}
                icon={<Plus aria-hidden="true" className="size-4" />}
              >
                {t("historico:include")}
              </Button>
            </div>
          )}
        </div>
      )}
    </article>
  );
};

/** Folgas seguidas sem marcação: um cartão recolhido "dom, 22 nov · sáb, 21 nov — Folga" (ou "1–17 nov"). */
export const DaysOffCard = ({ days }: { days: DayRecord[] }) => {
  const { t } = useTranslation();
  const label = daysOffLabel(days);
  return (
    <article
      aria-label={label}
      className="flex min-h-14 items-center gap-2.5 rounded-card border border-separator bg-surface px-4 py-2.5 shadow-sm"
    >
      <h2 className="min-w-0 flex-1 text-body font-semibold text-muted">{label}</h2>
      <span className="text-body-sm text-muted">{t("historico:day.dayOff")}</span>
    </article>
  );
};

export default DayCard;
