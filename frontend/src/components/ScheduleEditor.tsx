import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowDown, ArrowUp, ChevronDown, CircleAlert, Copy, Plus, Trash2 } from "lucide-react";
import { useIsDesktop } from "../hooks/useMediaQuery";
import type { ScheduleMode } from "../types/schedule";
import { cn } from "../utils/cn";
import { notifySuccess } from "../utils/notify";
import {
  MAX_PERIODS,
  WEEK_ORDER,
  clonePeriods,
  periodDraft,
  scheduleFieldId,
  switchMode,
} from "../utils/schedule";
import type { DayDraft, PeriodDraft, ScheduleDraft, ScheduleErrors } from "../utils/schedule";
import { Button } from "./Button";
import { Modal, ModalBody, ModalContent, ModalDescription, ModalHeader, ModalTitle } from "./Modal";
import { TextField } from "./TextField";

export interface ScheduleEditorProps {
  value: ScheduleDraft;
  onChange: (draft: ScheduleDraft) => void;
  /** Erros por chave do rascunho (validação local e `erros[]` da API) */
  errors?: ScheduleErrors;
  /** Hoje no fuso da empresa (mínimo da vigência) */
  today: string;
  /** Prefixo dos ids dos campos (foco no primeiro erro) */
  idPrefix: string;
  /** "Vale a partir de" editável; `false` = somente leitura com hoje (a criação do cargo sempre vale de hoje) */
  showEffectiveFrom?: boolean;
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// Lista de períodos (adicionar, renomear, reordenar com botões, remover)
// ---------------------------------------------------------------------------

interface PeriodListProps {
  periods: PeriodDraft[];
  onChange: (periods: PeriodDraft[]) => void;
  /** Prefixo das chaves de erro (`""` semanal, `day6.` diário) */
  errorPrefix: string;
  errors: ScheduleErrors;
  idPrefix: string;
  disabled: boolean;
}

const PeriodList = ({ periods, onChange, errorPrefix, errors, idPrefix, disabled }: PeriodListProps) => {
  const { t } = useTranslation();
  const [announcement, setAnnouncement] = useState("");
  const pendingFocus = useRef<string | null>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const listError = errors[`${errorPrefix}periods`];

  useEffect(() => {
    if (!pendingFocus.current) return;
    const target = document.getElementById(pendingFocus.current);
    pendingFocus.current = null;
    target?.focus();
  });

  const labelOf = (period: PeriodDraft, index: number): string =>
    period.name.trim() || t("cargos:editor.periodNumber", { number: index + 1 });

  const update = (index: number, patch: Partial<PeriodDraft>) =>
    onChange(periods.map((period, position) => (position === index ? { ...period, ...patch } : period)));

  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    const moving = periods[index];
    const other = periods[target];
    if (!moving || !other) return;
    const next = [...periods];
    next[index] = other;
    next[target] = moving;
    onChange(next);
    // Mantém o foco no mesmo botão; na ponta da lista, passa para a outra seta
    const atEdge = target === 0 || target === periods.length - 1;
    const direction = atEdge ? (delta === -1 ? "down" : "up") : delta === -1 ? "up" : "down";
    pendingFocus.current = `${idPrefix}-${moving.id}-${direction}`;
    setAnnouncement(t("cargos:editor.moved", { name: labelOf(moving, index), position: target + 1 }));
  };

  const remove = (index: number) => {
    const removed = periods[index];
    if (!removed) return;
    onChange(periods.filter((_, position) => position !== index));
    setAnnouncement(t("cargos:editor.removed", { name: labelOf(removed, index) }));
    addRef.current?.focus();
  };

  const add = () => {
    const created = periodDraft();
    onChange([...periods, created]);
    pendingFocus.current = scheduleFieldId(idPrefix, `${errorPrefix}periods.${periods.length}.name`);
  };

  return (
    // N-01: `@container` — a linha do período se adapta à largura da própria lista (painel do dia
    // estreito no modo diário, menu lateral aberto), não à largura da janela
    <div data-testid="period-list" className="@container flex min-w-0 flex-col gap-1">
      {listError && (
        <p
          id={scheduleFieldId(idPrefix, `${errorPrefix}periods`)}
          tabIndex={-1}
          className="flex items-start gap-1.5 text-body-sm font-[550] text-danger"
        >
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {listError}
        </p>
      )}
      <ol className="flex flex-col">
        {periods.map((period, index) => {
          const nameKey = `${errorPrefix}periods.${index}.name`;
          const timeKey = `${errorPrefix}periods.${index}.expectedTime`;
          const label = labelOf(period, index);
          return (
            <li
              key={period.id}
              className="grid grid-cols-[24px_minmax(0,1fr)] gap-x-2.5 gap-y-2 border-t border-separator py-3 first:border-t-0"
            >
              <span
                aria-hidden="true"
                className="mt-9 grid size-6 place-items-center rounded-full bg-surface-2 text-[0.75rem] font-extrabold"
              >
                {index + 1}
              </span>
              {/* I-12: rótulos de uma linha + `items-end` alinham os dois campos. I-13/N-01: as ações
                  só ficam à direita do "Previsto" quando a LISTA tem ≥ 36rem (576 px — o nome fica
                  com ≥ 260 px); abaixo disso vão para a linha de baixo, e abaixo de 18rem nome e
                  previsto também empilham (o nome nunca encolhe a ponto de quebrar o rótulo) */}
              <div
                data-testid="period-row"
                className="grid grid-cols-1 items-end gap-2 @min-[18rem]:grid-cols-[minmax(0,1fr)_minmax(0,7.5rem)] @min-[36rem]:grid-cols-[minmax(0,1fr)_minmax(0,7.5rem)_auto]"
              >
                <TextField
                  id={scheduleFieldId(idPrefix, nameKey)}
                  label={t("cargos:editor.periodName")}
                  placeholder={t("cargos:editor.periodPlaceholder")}
                  value={period.name}
                  maxLength={60}
                  disabled={disabled}
                  onChange={(event) => update(index, { name: event.target.value })}
                  error={errors[nameKey]}
                />
                <TextField
                  id={scheduleFieldId(idPrefix, timeKey)}
                  label={t("cargos:editor.expected")}
                  type="time"
                  className="tabular-nums"
                  value={period.expectedTime}
                  disabled={disabled}
                  onChange={(event) => update(index, { expectedTime: event.target.value })}
                  error={errors[timeKey]}
                />
              <div className="col-span-full -mt-1 flex justify-end gap-1 @min-[36rem]:col-span-1 @min-[36rem]:mt-0 @min-[36rem]:pb-0.5">
                <Button
                  variant="icon"
                  id={`${idPrefix}-${period.id}-up`}
                  aria-label={t("cargos:editor.moveUp", { name: label })}
                  disabled={disabled || index === 0}
                  onClick={() => move(index, -1)}
                  icon={<ArrowUp aria-hidden="true" className="size-5" />}
                />
                <Button
                  variant="icon"
                  id={`${idPrefix}-${period.id}-down`}
                  aria-label={t("cargos:editor.moveDown", { name: label })}
                  disabled={disabled || index === periods.length - 1}
                  onClick={() => move(index, 1)}
                  icon={<ArrowDown aria-hidden="true" className="size-5" />}
                />
                <Button
                  variant="icon"
                  aria-label={t("cargos:editor.remove", { name: label })}
                  disabled={disabled || periods.length <= 1}
                  onClick={() => remove(index)}
                  className="text-danger"
                  icon={<Trash2 aria-hidden="true" className="size-5" />}
                />
              </div>
              </div>
            </li>
          );
        })}
      </ol>
      <Button
        ref={addRef}
        variant="tertiary"
        className="self-start"
        disabled={disabled || periods.length >= MAX_PERIODS}
        onClick={add}
        icon={<Plus aria-hidden="true" className="size-5" />}
      >
        {t("cargos:editor.addPeriod")}
      </Button>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Controle segmentado (modo da jornada)
// ---------------------------------------------------------------------------

const ModeSelector = ({
  mode,
  onChange,
  disabled,
  helpId,
}: {
  mode: ScheduleMode;
  onChange: (mode: ScheduleMode) => void;
  disabled: boolean;
  helpId: string;
}) => {
  const { t } = useTranslation();
  const name = useId();
  const options: ScheduleMode[] = ["weekly", "daily"];
  return (
    <div
      role="radiogroup"
      aria-label={t("cargos:editor.modeLabel")}
      aria-describedby={helpId}
      className="flex gap-1 rounded-control bg-surface-2 p-1"
    >
      {options.map((option) => {
        const checked = option === mode;
        return (
          <label
            key={option}
            className={cn(
              "relative grid min-h-touch flex-1 cursor-pointer place-items-center rounded-[9px] px-2 text-center text-[0.9375rem]",
              "has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus",
              checked ? "bg-surface font-bold text-text shadow-sm" : "font-semibold text-muted",
            )}
          >
            <input
              type="radio"
              name={name}
              value={option}
              checked={checked}
              disabled={disabled}
              onChange={() => onChange(option)}
              className="absolute size-px opacity-0"
            />
            {t(`cargos:editor.mode.${option}`)}
          </label>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------

const countErrors = (errors: ScheduleErrors, prefix: string): number =>
  Object.keys(errors).filter((key) => key.startsWith(prefix)).length;

/**
 * Editor de jornada (components.md §6.1, mockup position-editor.html; FR-018): modo semanal
 * (dias úteis + períodos + cargas) ou diário (painel por dia com "copiar de outro dia"),
 * reordenação por botões acessíveis, cargas em `hh:mm`, vigência não passada e erros no campo.
 */
export const ScheduleEditor = ({
  value,
  onChange,
  errors = {},
  today,
  idPrefix,
  showEffectiveFrom = true,
  disabled = false,
}: ScheduleEditorProps) => {
  const { t } = useTranslation();
  const modeHelpId = useId();
  const [openDays, setOpenDays] = useState<number[]>(() =>
    value.mode === "daily" ? WEEK_ORDER.filter((dow) => value.days[dow]?.workDay).slice(0, 1) : [],
  );
  const [copyTarget, setCopyTarget] = useState<number | null>(null);
  const isDesktop = useIsDesktop();
  /** Dia mostrado no painel à direita (modo diário ≥ 1024 px) */
  const [selectedDay, setSelectedDay] = useState<number>(
    () => WEEK_ORDER.find((dow) => value.days[dow]?.workDay) ?? WEEK_ORDER[0] ?? 1,
  );

  // Dias com erro abrem sozinhos (o erro fica visível no lugar exato); no computador, o painel
  // vai para o primeiro dia com erro se o dia escolhido não tiver nenhum
  useEffect(() => {
    const withErrors = WEEK_ORDER.filter((dow) => countErrors(errors, `day${dow}.`) > 0);
    if (withErrors.length === 0) return;
    setOpenDays((previous) =>
      withErrors.every((dow) => previous.includes(dow)) ? previous : Array.from(new Set([...previous, ...withErrors])),
    );
    setSelectedDay((previous) => (withErrors.includes(previous) ? previous : (withErrors[0] ?? previous)));
  }, [errors]);

  const dayName = (dow: number) => t(`comum:weekdays.${dow}`);
  const field = (key: string) => scheduleFieldId(idPrefix, key);

  const setDay = (dow: number, patch: Partial<DayDraft>) =>
    onChange({
      ...value,
      days: value.days.map((day) => (day.dayOfWeek === dow ? { ...day, ...patch } : day)),
    });

  const toggleWorkDay = (dow: number) => {
    const workDays = value.workDays.includes(dow)
      ? value.workDays.filter((item) => item !== dow)
      : [...value.workDays, dow];
    onChange({ ...value, workDays });
  };

  const toggleDailyWorkDay = (day: DayDraft) => {
    const enabling = !day.workDay;
    const template = WEEK_ORDER.map((dow) => value.days[dow]).find((item) => item?.workDay);
    setDay(day.dayOfWeek, {
      workDay: enabling,
      // Dia novo começa com a configuração do primeiro dia útil (ou um período vazio)
      ...(enabling && day.periods.length === 0
        ? {
            periods: template ? clonePeriods(template.periods) : [periodDraft()],
            dailyLoad: template?.dailyLoad ?? day.dailyLoad,
          }
        : {}),
    });
    if (enabling) {
      setOpenDays((previous) => Array.from(new Set([...previous, day.dayOfWeek])));
      setSelectedDay(day.dayOfWeek);
    }
  };

  const toggleOpen = (dow: number) =>
    setOpenDays((previous) => (previous.includes(dow) ? previous.filter((item) => item !== dow) : [...previous, dow]));

  const copyFrom = (source: number) => {
    const target = copyTarget;
    const from = value.days[source];
    if (target === null || !from) return;
    setDay(target, { periods: clonePeriods(from.periods), dailyLoad: from.dailyLoad, workDay: true });
    setCopyTarget(null);
    notifySuccess(t("cargos:editor.copied", { from: dayName(source), to: dayName(target) }));
  };

  const copySources =
    copyTarget === null
      ? []
      : WEEK_ORDER.filter((dow) => dow !== copyTarget && value.days[dow]?.workDay && (value.days[dow]?.periods.length ?? 0) > 0);

  const workDaysError = errors.workDays;

  /**
   * Resumo do dia: erros, "4 períodos · 08:00" ou "Folga". N-06: cada parte é indivisível
   * (`whitespace-nowrap`) — se faltar espaço, quebra só entre "4 períodos" e "· 08:00".
   */
  const daySummaryText = (day: DayDraft, dayErrors: number) => (
    <span className={cn("block text-caption", dayErrors > 0 ? "font-[650] text-danger" : "text-muted")}>
      {dayErrors > 0 ? (
        t("cargos:editor.dayErrors", { count: dayErrors })
      ) : day.workDay ? (
        <>
          <span className="whitespace-nowrap">{t("cargos:editor.dayPeriods", { count: day.periods.length })}</span>{" "}
          <span className="whitespace-nowrap">{t("cargos:editor.dayLoadSuffix", { load: day.dailyLoad || "—" })}</span>
        </>
      ) : (
        t("cargos:editor.dayOff")
      )}
    </span>
  );

  /**
   * Switch "Dia útil" (A-14): texto `caption` visível à esquerda da chave, dentro do próprio
   * botão (área de toque maior); o nome acessível "Segunda é dia útil" contém o texto visível.
   */
  const workDaySwitch = (day: DayDraft) => (
    <button
      type="button"
      role="switch"
      aria-checked={day.workDay}
      aria-label={t("cargos:editor.isWorkDay", { day: dayName(day.dayOfWeek) })}
      disabled={disabled}
      onClick={() => toggleDailyWorkDay(day)}
      className="flex min-h-touch shrink-0 items-center gap-2 rounded-full px-1.5"
    >
      <span aria-hidden="true" className="text-caption font-semibold text-muted">
        {t("cargos:editor.workDayShort")}
      </span>
      <span
        aria-hidden="true"
        className={cn("relative block h-7 w-11 rounded-full transition-colors", day.workDay ? "bg-primary" : "bg-border")}
      >
        <span
          className={cn(
            "absolute top-[3px] size-[22px] rounded-full bg-white shadow-sm transition-[left]",
            day.workDay ? "left-[19px]" : "left-[3px]",
          )}
        />
      </span>
    </button>
  );

  /** Corpo do dia (modo diário): copiar de outro dia, períodos e carga do dia. */
  const dayPanel = (dow: number, day: DayDraft) => (
    <div className="flex flex-col gap-3 px-4 pt-2 pb-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-title-sm text-text">{dayName(dow)}</h3>
        <Button
          variant="secondary"
          size="sm"
          disabled={disabled}
          onClick={() => setCopyTarget(dow)}
          icon={<Copy aria-hidden="true" className="size-4" />}
        >
          {t("cargos:editor.copyFrom")}
        </Button>
      </div>
      <PeriodList
        periods={day.periods}
        onChange={(periods) => setDay(dow, { periods })}
        errorPrefix={`day${dow}.`}
        errors={errors}
        idPrefix={idPrefix}
        disabled={disabled}
      />
      <TextField
        id={field(`day${dow}.dailyMinutes`)}
        label={t("cargos:editor.dayLoad")}
        inputMode="numeric"
        placeholder={t("cargos:editor.dailyLoadPlaceholder")}
        containerClassName="max-w-60"
        className="tabular-nums"
        help={t("cargos:editor.loadHelp")}
        value={day.dailyLoad}
        disabled={disabled}
        onChange={(event) => setDay(dow, { dailyLoad: event.target.value })}
        error={errors[`day${dow}.dailyMinutes`]}
      />
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Modo */}
      <section className="flex flex-col gap-2 rounded-card border border-separator bg-surface p-4 shadow-sm">
        <h2 className="text-title-sm text-text">{t("cargos:editor.scheduleTitle")}</h2>
        <ModeSelector
          mode={value.mode}
          disabled={disabled}
          helpId={modeHelpId}
          onChange={(mode) => {
            const next = switchMode(value, mode);
            onChange(next);
            if (mode === "daily") {
              const first = WEEK_ORDER.filter((dow) => next.days[dow]?.workDay).slice(0, 1);
              setOpenDays(first);
              if (first[0] !== undefined) setSelectedDay(first[0]);
            }
          }}
        />
        <p id={modeHelpId} className="text-caption text-muted">
          {t(`cargos:editor.modeHelp.${value.mode}`)}
        </p>
      </section>

      {value.mode === "weekly" ? (
        <>
          <section className="rounded-card border border-separator bg-surface p-4 shadow-sm">
            <fieldset aria-describedby={workDaysError ? field("workDays") : undefined}>
              <legend className="mb-2 text-label text-text">{t("cargos:editor.workDays")}</legend>
              <div className="grid grid-cols-4 gap-1.5 min-[460px]:grid-cols-7">
                {WEEK_ORDER.map((dow) => {
                  const checked = value.workDays.includes(dow);
                  return (
                    <label
                      key={dow}
                      className={cn(
                        "relative grid min-h-12 min-w-touch cursor-pointer place-items-center rounded-control border text-[0.8125rem] font-[750] tracking-[0.04em] uppercase",
                        "has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus",
                        checked ? "border-primary bg-primary text-on-primary" : "border-border bg-surface text-muted",
                        disabled && "cursor-not-allowed opacity-60",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => toggleWorkDay(dow)}
                        aria-label={dayName(dow)}
                        className="absolute size-px opacity-0"
                      />
                      <span aria-hidden="true">{t(`comum:weekdaysShort.${dow}`)}</span>
                      {checked && (
                        <span aria-hidden="true" className="absolute top-0.5 right-1 text-[0.6875rem]">
                          ✓
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
              {workDaysError && (
                <p id={field("workDays")} tabIndex={-1} className="mt-2 flex items-start gap-1.5 text-body-sm font-[550] text-danger">
                  <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                  {workDaysError}
                </p>
              )}
            </fieldset>
          </section>

          <section className="rounded-card border border-separator bg-surface p-4 shadow-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-title-sm text-text">{t("cargos:editor.periods")}</h2>
              <span className="text-caption text-muted">{t("cargos:editor.periodsHint")}</span>
            </div>
            <PeriodList
              periods={value.periods}
              onChange={(periods) => onChange({ ...value, periods })}
              errorPrefix=""
              errors={errors}
              idPrefix={idPrefix}
              disabled={disabled}
            />
          </section>
        </>
      ) : (
        <section aria-label={t("cargos:editor.daysLabel")} className="flex flex-col gap-2">
          {workDaysError && (
            <p id={field("workDays")} tabIndex={-1} className="flex items-start gap-1.5 text-body-sm font-[550] text-danger">
              <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              {workDaysError}
            </p>
          )}
          {isDesktop ? (
            // I-14/N-01: ≥ 1024 px, dias numa lista com o dia escolhido num painel. Lado a lado
            // (lista vertical à esquerda) só quando a coluna do editor tem ≥ 41rem — o painel fica
            // com ≥ 400 px; abaixo disso (1024–~1300 px com o menu lateral e o resumo) os dias
            // viram uma grade em cima e o painel ocupa a largura toda embaixo
            <div data-testid="daily-layout" className="@container min-w-0">
             <div className="grid items-start gap-4 @min-[41rem]:grid-cols-[15rem_minmax(0,1fr)] @min-[60rem]:grid-cols-[17.5rem_minmax(0,1fr)]">
              <ul
                aria-label={t("cargos:editor.daysTabsLabel")}
                className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-1.5 @min-[41rem]:flex @min-[41rem]:flex-col"
              >
                {WEEK_ORDER.map((dow) => {
                  const day = value.days[dow];
                  if (!day) return null;
                  const dayErrors = countErrors(errors, `day${dow}.`);
                  const selected = dow === selectedDay;
                  return (
                    <li
                      key={dow}
                      className={cn(
                        "flex min-h-14 items-center gap-1 rounded-control border bg-surface py-1 pr-2 pl-1",
                        dayErrors > 0
                          ? "border-2 border-danger"
                          : selected
                            ? "border-2 border-primary bg-primary-soft"
                            : "border-separator",
                      )}
                    >
                      <button
                        type="button"
                        aria-current={selected ? "true" : undefined}
                        aria-controls={selected ? `${idPrefix}-dia-painel` : undefined}
                        onClick={() => setSelectedDay(dow)}
                        className="flex min-h-touch min-w-0 flex-1 flex-col items-start justify-center rounded-control px-2 text-left"
                      >
                        <span className="font-bold text-text">{dayName(dow)}</span>
                        {daySummaryText(day, dayErrors)}
                      </button>
                      {workDaySwitch(day)}
                    </li>
                  );
                })}
              </ul>
              {(() => {
                const day = value.days[selectedDay];
                if (!day) return null;
                return (
                  <div
                    id={`${idPrefix}-dia-painel`}
                    className="min-w-0 rounded-card border border-separator bg-surface shadow-sm"
                  >
                    {day.workDay ? (
                      dayPanel(selectedDay, day)
                    ) : (
                      <div className="flex flex-col gap-1 px-4 py-4">
                        <h3 className="text-title-sm text-text">{dayName(selectedDay)}</h3>
                        <p className="text-body-sm text-muted">{t("cargos:editor.dayOff")}</p>
                      </div>
                    )}
                  </div>
                );
              })()}
             </div>
            </div>
          ) : (
            WEEK_ORDER.map((dow) => {
              const day = value.days[dow];
              if (!day) return null;
              const open = day.workDay && openDays.includes(dow);
              const dayErrors = countErrors(errors, `day${dow}.`);
              const panelId = `${idPrefix}-dia-${dow}`;
              return (
                <div
                  key={dow}
                  className={cn(
                    "rounded-control border bg-surface",
                    dayErrors > 0 ? "border-2 border-danger" : open ? "border-2 border-primary" : "border-separator",
                  )}
                >
                  <div className="flex min-h-14 items-center gap-1.5 py-1.5 pr-2 pl-1">
                    <button
                      type="button"
                      aria-expanded={day.workDay ? open : undefined}
                      aria-controls={open ? panelId : undefined}
                      disabled={!day.workDay}
                      onClick={() => toggleOpen(dow)}
                      className="flex min-h-touch min-w-0 flex-1 items-center gap-2 rounded-control px-2 text-left disabled:cursor-default"
                    >
                      {/* N-06: resumo embaixo do nome (largura toda da linha), como na lista ≥ 1024 */}
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="font-bold text-text">{dayName(dow)}</span>
                        {daySummaryText(day, dayErrors)}
                      </span>
                      {day.workDay && (
                        <ChevronDown
                          aria-hidden="true"
                          className={cn("size-5 shrink-0 text-muted transition-transform", open && "rotate-180")}
                        />
                      )}
                    </button>
                    {workDaySwitch(day)}
                  </div>
                  {open && (
                    <div id={panelId} className="border-t border-separator">
                      {dayPanel(dow, day)}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </section>
      )}

      {/* Cargas e vigência */}
      <section className="flex flex-col gap-3 rounded-card border border-separator bg-surface p-4 shadow-sm">
        <div className={cn("grid gap-3", value.mode === "weekly" && "min-[420px]:grid-cols-2")}>
          {value.mode === "weekly" && (
            <TextField
              id={field("dailyMinutes")}
              label={t("cargos:editor.dailyLoad")}
              inputMode="numeric"
              placeholder={t("cargos:editor.dailyLoadPlaceholder")}
              className="tabular-nums"
              help={t("cargos:editor.loadHelp")}
              value={value.dailyLoad}
              disabled={disabled}
              onChange={(event) => onChange({ ...value, dailyLoad: event.target.value })}
              error={errors.dailyMinutes}
            />
          )}
          <TextField
            id={field("weeklyMinutes")}
            label={t("cargos:editor.weeklyLoad")}
            inputMode="numeric"
            placeholder={t("cargos:editor.weeklyLoadPlaceholder")}
            className="tabular-nums"
            help={t("cargos:editor.loadHelp")}
            value={value.weeklyLoad}
            disabled={disabled}
            onChange={(event) => onChange({ ...value, weeklyLoad: event.target.value })}
            error={errors.weeklyMinutes}
          />
        </div>
        {showEffectiveFrom ? (
          <TextField
            id={field("effectiveFrom")}
            label={t("cargos:editor.effectiveFrom")}
            type="date"
            min={today}
            help={t("cargos:editor.effectiveHelp")}
            value={value.effectiveFrom}
            disabled={disabled}
            onChange={(event) => onChange({ ...value, effectiveFrom: event.target.value })}
            error={errors.effectiveFrom}
          />
        ) : (
          // A-15: cargo novo também mostra a vigência — sempre hoje (a API cria a primeira versão
          // com a data de criação), então o campo é somente leitura
          <TextField
            id={field("effectiveFrom")}
            label={t("cargos:editor.effectiveFrom")}
            type="date"
            readOnly
            help={t("cargos:editor.effectiveNewHelp")}
            value={today}
          />
        )}
      </section>

      <Modal open={copyTarget !== null} onOpenChange={(open) => (open ? undefined : setCopyTarget(null))}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>{t("cargos:editor.copyTitle", { day: copyTarget !== null ? dayName(copyTarget) : "" })}</ModalTitle>
            <ModalDescription>{t("cargos:editor.copyDescription")}</ModalDescription>
          </ModalHeader>
          <ModalBody>
            {copySources.length === 0 ? (
              <p className="text-body-sm text-muted">{t("cargos:editor.copyEmpty")}</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {copySources.map((dow) => (
                  <li key={dow}>
                    <Button variant="secondary" fullWidth className="justify-between" onClick={() => copyFrom(dow)}>
                      <span>{dayName(dow)}</span>
                      <span className="text-caption font-medium text-muted">
                        {t("cargos:editor.daySummary", {
                          count: value.days[dow]?.periods.length ?? 0,
                          load: value.days[dow]?.dailyLoad || "—",
                        })}
                      </span>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </div>
  );
};

export default ScheduleEditor;
