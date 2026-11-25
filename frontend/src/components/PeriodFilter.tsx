import { useState } from "react";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, SlidersHorizontal, X } from "lucide-react";
import type { PeriodFilterState } from "../hooks/usePeriodFilter";
import { addDays, dayOfWeek } from "../utils/dateTime";
import { periodBounds, validateRange } from "../utils/period";
import type { RangeError } from "../utils/period";
import { cn } from "../utils/cn";
import { Button } from "./Button";
import { Modal, ModalBody, ModalContent, ModalDescription, ModalFooter, ModalHeader, ModalTitle } from "./Modal";
import { TextField } from "./TextField";

export interface PeriodFilterProps {
  /** Estado de `usePeriodFilter()` (a tela também usa `query` para carregar os dados) */
  filter: PeriodFilterState;
  className?: string;
}

interface RangeErrors {
  start?: string;
  end?: string;
}

/** Segunda-feira da semana de `ymd`. */
const mondayOf = (ymd: string): string => addDays(ymd, -((dayOfWeek(ymd) + 6) % 7));

/**
 * Filtro de período (components.md §4.1–4.2): mês com ‹ ›, rótulo anunciado
 * (`aria-live`) e "Filtro avançado" em modal com início/fim (máx. 366 dias).
 */
export const PeriodFilter = ({ filter, className }: PeriodFilterProps) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [errors, setErrors] = useState<RangeErrors>({});

  const openModal = () => {
    const bounds = periodBounds(filter.period);
    setStart(bounds.start);
    setEnd(bounds.end > filter.today && !filter.isRange ? filter.today : bounds.end);
    setErrors({});
    setOpen(true);
  };

  const errorText = (code: RangeError): RangeErrors => {
    switch (code) {
      case "invalidStart":
        return { start: t("comum:period.errors.invalidStart") };
      case "invalidEnd":
        return { end: t("comum:period.errors.invalidEnd") };
      case "order":
        return { end: t("comum:period.errors.order") };
      case "tooLong":
        return { end: t("comum:period.errors.tooLong") };
    }
  };

  const apply = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = validateRange(start, end);
    if (code) {
      setErrors(errorText(code));
      return;
    }
    filter.setRange(start, end);
    setOpen(false);
  };

  const applyShortcut = (from: string, to: string) => {
    setStart(from);
    setEnd(to);
    setErrors({});
  };

  const thisMonday = mondayOf(filter.today);
  const shortcuts = [
    { key: "thisWeek", from: thisMonday, to: addDays(thisMonday, 6) },
    { key: "lastWeek", from: addDays(thisMonday, -7), to: addDays(thisMonday, -1) },
    { key: "last30", from: addDays(filter.today, -29), to: filter.today },
  ];

  return (
    <div className={cn("flex min-h-control items-center gap-1", className)}>
      <Button
        variant="icon"
        aria-label={t("comum:period.previous")}
        onClick={filter.previousMonth}
        icon={<ChevronLeft aria-hidden="true" className="size-6" />}
      />
      <p aria-live="polite" className="min-w-0 flex-1 text-center text-title-sm text-text tabular">
        {filter.label}
      </p>
      <Button
        variant="icon"
        aria-label={t("comum:period.next")}
        onClick={filter.nextMonth}
        disabled={!filter.canGoNext}
        icon={<ChevronRight aria-hidden="true" className="size-6" />}
      />
      {filter.isRange ? (
        <span className="flex items-center rounded-control bg-primary-soft text-primary">
          <button
            type="button"
            onClick={openModal}
            className="min-h-touch rounded-control px-3 text-body-sm font-semibold"
          >
            {t("comum:period.custom")}
          </button>
          <button
            type="button"
            onClick={filter.clearRange}
            aria-label={t("comum:period.clear")}
            className="inline-grid size-touch place-items-center rounded-control"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </span>
      ) : (
        <Button
          variant="tertiary"
          onClick={openModal}
          icon={<SlidersHorizontal aria-hidden="true" className="size-5" />}
          className="min-w-touch px-2"
        >
          <span className="sr-only min-[400px]:not-sr-only">{t("comum:period.advanced")}</span>
        </Button>
      )}

      <Modal open={open} onOpenChange={setOpen}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>{t("comum:period.modalTitle")}</ModalTitle>
            <ModalDescription>{t("comum:period.modalDescription")}</ModalDescription>
          </ModalHeader>
          <form noValidate onSubmit={apply}>
            <ModalBody>
              <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
                <TextField
                  label={t("comum:period.start")}
                  type="date"
                  value={start}
                  onChange={(event) => setStart(event.target.value)}
                  error={errors.start}
                />
                <TextField
                  label={t("comum:period.end")}
                  type="date"
                  value={end}
                  onChange={(event) => setEnd(event.target.value)}
                  error={errors.end}
                />
              </div>
              <div role="group" aria-label={t("comum:period.shortcuts")} className="flex flex-wrap gap-2">
                {shortcuts.map((shortcut) => {
                  const selected = start === shortcut.from && end === shortcut.to;
                  return (
                    <button
                      key={shortcut.key}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => applyShortcut(shortcut.from, shortcut.to)}
                      className={cn(
                        "min-h-touch rounded-full border px-4 text-body-sm font-semibold",
                        selected ? "border-primary bg-primary-soft text-primary" : "border-border bg-surface text-text",
                      )}
                    >
                      {t(`comum:period.${shortcut.key}`)}
                    </button>
                  );
                })}
              </div>
            </ModalBody>
            <ModalFooter>
              <Button
                variant="tertiary"
                onClick={() => {
                  filter.clearRange();
                  setOpen(false);
                }}
              >
                {t("comum:period.reset")}
              </Button>
              <Button type="submit">{t("comum:period.apply")}</Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>
    </div>
  );
};

export default PeriodFilter;
