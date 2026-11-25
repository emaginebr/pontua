import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { Trans, useTranslation } from "react-i18next";
import { ChevronRight } from "lucide-react";
import { fieldErrorsOf, toErrorMessage } from "../Services/apiClient";
import type { ManualPunchInput, PunchInfo } from "../types/punch";
import { formatYmdDayMonth, formatYmdNumeric, formatYmdShort, isValidYmd } from "../utils/dateTime";
import { Button } from "./Button";
import { Modal, ModalBody, ModalContent, ModalDescription, ModalFooter, ModalHeader, ModalTitle } from "./Modal";
import { Notice } from "./Notice";
import { TextArea } from "./TextArea";
import { TextField } from "./TextField";

/** Limites da justificativa (`ManualPunchInsertInfo` do backend). */
export const JUSTIFICATION_MIN_LENGTH = 5;
export const JUSTIFICATION_MAX_LENGTH = 500;

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

type ManualField = "workDate" | "time" | "justification";
const FIELD_ORDER: readonly ManualField[] = ["workDate", "time", "justification"];

/** Marcação a corrigir, com o nome exibido da linha ("Saída" ou "Extra"). */
export interface ManualOriginal {
  punch: PunchInfo;
  name: string;
}

export interface ManualPunchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `include` = marcação esquecida · `correct` = corrigir horário de `original` */
  mode: "include" | "correct";
  original?: ManualOriginal | null;
  /** Data sugerida (`yyyy-MM-dd`) */
  initialDate: string;
  /** Primeira data permitida: `max(hoje − manualRetroDays, entrada do membro)` (research R-13) */
  minDate: string;
  /** Hoje no fuso da empresa */
  maxDate: string;
  /** Agora (`HH:mm`) no fuso da empresa — horário de hoje não pode passar disto */
  nowTime: string;
  /** Envia o pedido; erros da API com `erros[]` voltam para os campos */
  onSubmit: (input: ManualPunchInput) => Promise<void>;
}

/**
 * Folha "Incluir marcação" / "Corrigir horário" (components.md §3.5, mockup history.html §3;
 * FR-016, research R-13): data limitada ao intervalo permitido, horário não futuro, justificativa
 * obrigatória (5–500) com contador e erros por campo, inclusive os da API.
 */
export const ManualPunchModal = ({
  open,
  onOpenChange,
  mode,
  original = null,
  initialDate,
  minDate,
  maxDate,
  nowTime,
  onSubmit,
}: ManualPunchModalProps) => {
  const { t } = useTranslation();
  const correcting = mode === "correct" && original !== null;
  const [workDate, setWorkDate] = useState(correcting ? original.punch.workDate : initialDate);
  const [time, setTime] = useState("");
  const [justification, setJustification] = useState("");
  const [errors, setErrors] = useState<Partial<Record<ManualField, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const refs = {
    workDate: useRef<HTMLInputElement>(null),
    time: useRef<HTMLInputElement>(null),
    justification: useRef<HTMLTextAreaElement>(null),
  };

  const validate = (): Partial<Record<ManualField, string>> => {
    const next: Partial<Record<ManualField, string>> = {};
    if (!isValidYmd(workDate)) next.workDate = t("historico:manual.errors.dateRequired");
    else if (workDate < minDate || workDate > maxDate)
      next.workDate = t("historico:manual.errors.dateRange", { min: formatYmdDayMonth(minDate) });
    if (!time) next.time = t("historico:manual.errors.timeRequired");
    else if (!TIME_PATTERN.test(time)) next.time = t("historico:manual.errors.timeInvalid");
    else if (workDate === maxDate && time > nowTime) next.time = t("historico:manual.errors.timeFuture");
    const text = justification.trim();
    if (!text) next.justification = t("historico:manual.errors.justificationRequired");
    else if (text.length < JUSTIFICATION_MIN_LENGTH)
      next.justification = t("historico:manual.errors.justificationShort", { min: JUSTIFICATION_MIN_LENGTH });
    else if (text.length > JUSTIFICATION_MAX_LENGTH)
      next.justification = t("historico:manual.errors.justificationLong", { max: JUSTIFICATION_MAX_LENGTH });
    return next;
  };

  const focusFirst = (next: Partial<Record<ManualField, string>>) => {
    const first = FIELD_ORDER.find((field) => next[field]);
    if (first) refs[first].current?.focus();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) {
      focusFirst(next);
      return;
    }
    setSending(true);
    try {
      await onSubmit({
        workDate,
        time,
        justification: justification.trim(),
        replacesPunchId: correcting ? original.punch.punchId : null,
      });
      onOpenChange(false);
    } catch (err) {
      const fields = fieldErrorsOf(err);
      const apiErrors: Partial<Record<ManualField, string>> = {
        workDate: fields.workdate,
        time: fields.time,
        justification: fields.justification,
      };
      const hasField = FIELD_ORDER.some((field) => apiErrors[field]);
      setErrors(hasField ? apiErrors : {});
      if (hasField) focusFirst(apiErrors);
      else setFormError(toErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const errorCount = FIELD_ORDER.filter((field) => errors[field]).length;

  return (
    <Modal open={open} onOpenChange={(next) => (!sending || next ? onOpenChange(next) : undefined)}>
      <ModalContent size="lg">
        <ModalHeader>
          <ModalTitle>{correcting ? t("historico:manual.correctTitle") : t("historico:manual.includeTitle")}</ModalTitle>
          <ModalDescription>
            {correcting ? t("historico:manual.correctDescription") : t("historico:manual.includeDescription")}
          </ModalDescription>
        </ModalHeader>
        <form noValidate onSubmit={(event) => void handleSubmit(event)}>
          <ModalBody>
            {formError && (
              <Notice variant="danger" role="alert">
                {formError}
              </Notice>
            )}
            {!formError && errorCount > 1 && (
              <Notice variant="danger" role="alert">
                {t("comum:formErrorsSummary", { count: errorCount })}
              </Notice>
            )}

            {correcting && (
              <div className="flex flex-wrap items-center gap-3 rounded-control bg-surface-2 px-3.5 py-3">
                <span className="flex flex-col">
                  <span className="text-caption text-muted">{t("historico:day.original")}</span>
                  <span className="font-bold">
                    {t("historico:manual.originalValue", { name: original.name, time: original.punch.localTime })}
                  </span>
                  <span className="text-caption text-muted">{formatYmdShort(original.punch.workDate)}</span>
                </span>
                <ChevronRight aria-hidden="true" className="size-5 text-muted" />
                <span className="flex flex-col">
                  <span className="text-caption text-muted">{t("historico:day.correction")}</span>
                  <span className="font-bold tabular-nums">{time || "—"}</span>
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
              <TextField
                ref={refs.workDate}
                label={t("historico:manual.date")}
                type="date"
                value={workDate}
                min={minDate}
                max={maxDate}
                readOnly={correcting}
                help={
                  correcting
                    ? formatYmdNumeric(workDate)
                    : minDate === maxDate
                      ? t("historico:manual.dateHelpToday")
                      : t("historico:manual.dateHelp", { min: formatYmdDayMonth(minDate) })
                }
                onChange={(event) => setWorkDate(event.target.value)}
                error={errors.workDate}
              />
              <TextField
                ref={refs.time}
                label={correcting ? t("historico:manual.newTime") : t("historico:manual.time")}
                type="time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
                error={errors.time}
              />
            </div>

            <TextArea
              ref={refs.justification}
              label={t("historico:manual.justification")}
              placeholder={t("historico:manual.justificationPlaceholder")}
              value={justification}
              maxLength={JUSTIFICATION_MAX_LENGTH}
              showCounter
              onChange={(event) => setJustification(event.target.value)}
              error={errors.justification}
            />

            <Notice variant="info">
              <Trans i18nKey="historico:manual.pendingNote" components={{ strong: <strong className="font-bold" /> }} />
            </Notice>
          </ModalBody>
          <ModalFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={sending}>
              {t("comum:cancel")}
            </Button>
            <Button type="submit" loading={sending} loadingText={t("historico:manual.submitting")}>
              {t("historico:manual.submit")}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
};

export default ManualPunchModal;
