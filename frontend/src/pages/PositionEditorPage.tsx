import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Save, Trash2 } from "lucide-react";
import { Button } from "../components/Button";
import { ConfirmModal } from "../components/ConfirmModal";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { Notice } from "../components/Notice";
import { PageHeader } from "../components/PageHeader";
import { ScheduleEditor } from "../components/ScheduleEditor";
import { ScheduleSummary } from "../components/ScheduleSummary";
import { StaleDataNotice } from "../components/StaleDataNotice";
import { TextField } from "../components/TextField";
import { useCompany } from "../hooks/useCompany";
import { useConnectivity } from "../hooks/useConnectivity";
import { usePositions } from "../hooks/usePositions";
import { isApiError, toErrorMessage } from "../Services/apiClient";
import type { PositionInfo } from "../types/position";
import { DEFAULT_TIME_ZONE, formatYmdNumeric, todayInZone } from "../utils/dateTime";
import { notifySuccess } from "../utils/notify";
import {
  POSITION_NAME_MAX_LENGTH,
  defaultScheduleDraft,
  draftFromSchedule,
  mapApiScheduleErrors,
  orderedErrorKeys,
  scheduleFieldId,
  shapeFromDraft,
  shapeFromInfo,
  toScheduleInput,
  validateScheduleDraft,
} from "../utils/schedule";
import type { MappedApiErrors, ScheduleDraft, ScheduleErrors } from "../utils/schedule";

const ID_PREFIX = "jornada";
const NAME_FIELD_ID = "cargo-nome";

/** Status da API ao excluir cargo: 422 com membros ativos, 409 com histórico. */
const DELETE_BLOCKED_STATUSES = [409, 422];

/**
 * Editor de cargo e jornada (`/empresa/cargos/novo` e `/empresa/cargos/:positionId`, mockup
 * position-editor.html; US3, FR-018): nome, jornada semanal/diária, vigência, histórico de
 * versões e exclusão com explicação de 422/409.
 */
const PositionEditorPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { positionId: rawId } = useParams();
  const positionId = rawId !== undefined ? Number(rawId) : null;
  const isNew = positionId === null;
  const invalidId = positionId !== null && (!Number.isInteger(positionId) || positionId <= 0);
  const { activeCompany } = useCompany();
  const { isOnline } = useConnectivity();
  const { get, create, rename, saveSchedule, remove, stale, fetchedAt } = usePositions();
  const timeZone = activeCompany?.timeZone ?? DEFAULT_TIME_ZONE;
  const today = todayInZone(timeZone);

  const [position, setPosition] = useState<PositionInfo | null>(null);
  const [loadingPosition, setLoadingPosition] = useState(!isNew);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [draft, setDraft] = useState<ScheduleDraft>(() => defaultScheduleDraft(today));
  const [initialInput, setInitialInput] = useState<string>("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [errors, setErrors] = useState<ScheduleErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const formErrorRef = useRef<HTMLDivElement>(null);
  const deleteErrorRef = useRef<HTMLDivElement>(null);

  const companyId = activeCompany?.companyId ?? null;

  const load = useCallback(async () => {
    if (positionId === null || invalidId || companyId === null) return;
    try {
      setLoadingPosition(true);
      setLoadError(null);
      const info = await get(positionId);
      const base = info.currentSchedule ?? info.scheduleHistory?.[0] ?? null;
      const nextDraft = draftFromSchedule(base, today);
      setPosition(info);
      setName(info.name);
      setDraft(nextDraft);
      setInitialInput(JSON.stringify(toScheduleInput({ ...nextDraft, effectiveFrom: "" }, false)));
    } catch (err) {
      setLoadError(toErrorMessage(err));
    } finally {
      setLoadingPosition(false);
    }
  }, [positionId, invalidId, companyId, get, today]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (formError) formErrorRef.current?.focus();
  }, [formError]);

  useEffect(() => {
    if (deleteError) deleteErrorRef.current?.focus();
  }, [deleteError]);

  const validateName = (value: string): string | null => {
    const trimmed = value.trim();
    if (!trimmed) return t("cargos:errors.nameRequired");
    if (trimmed.length > POSITION_NAME_MAX_LENGTH) return t("cargos:errors.nameLength", { max: POSITION_NAME_MAX_LENGTH });
    return null;
  };

  const scheduleChanged =
    isNew || JSON.stringify(toScheduleInput({ ...draft, effectiveFrom: "" }, false)) !== initialInput;
  const effectiveChanged = !isNew && draft.effectiveFrom !== today;

  const runValidation = (nextDraft: ScheduleDraft, nextName: string) => {
    const scheduleErrors = isNew || scheduleChanged || effectiveChanged
      ? validateScheduleDraft(nextDraft, today, !isNew)
      : {};
    setErrors(scheduleErrors);
    const nextNameError = validateName(nextName);
    setNameError(nextNameError);
    return { scheduleErrors, nextNameError };
  };

  const focusFirstError = (scheduleErrors: ScheduleErrors, hasNameError: boolean) => {
    if (hasNameError) {
      document.getElementById(NAME_FIELD_ID)?.focus();
      return;
    }
    const first = orderedErrorKeys(draft, scheduleErrors)[0];
    if (!first) return;
    // Painéis do modo diário abrem no próximo render
    requestAnimationFrame(() => document.getElementById(scheduleFieldId(ID_PREFIX, first))?.focus());
  };

  const handleDraftChange = (next: ScheduleDraft) => {
    setDraft(next);
    if (submitted) runValidation(next, name);
    else if (Object.keys(errors).length > 0) setErrors({});
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    setFormError(null);
    const { scheduleErrors, nextNameError } = runValidation(draft, name);
    if (nextNameError || Object.keys(scheduleErrors).length > 0) {
      focusFirstError(scheduleErrors, Boolean(nextNameError));
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        await create({ name: name.trim(), schedule: toScheduleInput(draft, false) });
        notifySuccess(t("cargos:created", { name: name.trim() }));
      } else if (positionId !== null && position) {
        if (name.trim() !== position.name) await rename(positionId, name.trim());
        if (scheduleChanged || effectiveChanged) await saveSchedule(positionId, toScheduleInput(draft));
        notifySuccess(t("cargos:saved", { name: name.trim() }));
      }
      navigate("/empresa/cargos");
    } catch (err) {
      const mapped: MappedApiErrors = isApiError(err)
        ? mapApiScheduleErrors(err.erros, draft)
        : { fields: {}, name: null, general: [] };
      const fieldCount = Object.keys(mapped.fields).length;
      if (mapped.name) setNameError(mapped.name);
      if (fieldCount > 0) setErrors(mapped.fields);
      if (mapped.name || fieldCount > 0) {
        if (mapped.general.length > 0) setFormError(mapped.general.join(" "));
        focusFirstError(mapped.fields, Boolean(mapped.name));
      } else {
        setFormError(toErrorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (positionId === null) return;
    try {
      await remove(positionId);
      notifySuccess(t("cargos:deleted", { name: position?.name ?? "" }));
      setDeleteOpen(false);
      navigate("/empresa/cargos");
    } catch (err) {
      setDeleteOpen(false);
      if (isApiError(err) && DELETE_BLOCKED_STATUSES.includes(err.status)) {
        setDeleteError(`${err.mensagem} ${t("cargos:delete.renameHint")}`);
      } else {
        setDeleteError(toErrorMessage(err));
      }
    }
  };

  const errorCount = Object.keys(errors).length + (nameError ? 1 : 0);
  const shape = useMemo(() => shapeFromDraft(draft), [draft]);
  const title = isNew ? t("cargos:newTitle") : (position?.name ?? t("cargos:editorTitle"));
  const offline = !isOnline;

  if (invalidId) {
    return (
      <>
        <PageHeader title={t("cargos:editorTitle")} backTo="/empresa/cargos" />
        <ErrorState title={t("cargos:notFound")} message={t("cargos:notFoundText")} />
      </>
    );
  }

  if (!isNew && loadingPosition && !position) {
    return (
      <>
        <PageHeader title={t("cargos:editorTitle")} backTo="/empresa/cargos" />
        <LoadingState lines={8} />
      </>
    );
  }

  if (!isNew && loadError && !position) {
    return (
      <>
        <PageHeader title={t("cargos:editorTitle")} backTo="/empresa/cargos" />
        <ErrorState message={loadError} onRetry={() => void load()} retrying={loadingPosition} />
      </>
    );
  }

  const history = position?.scheduleHistory ?? [];

  return (
    <>
      <PageHeader title={title} backTo="/empresa/cargos" />
      {!isNew && <StaleDataNotice stale={stale} fetchedAt={fetchedAt} timeZone={timeZone} className="mb-4" />}

      <form noValidate onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-4">
        {formError && (
          <Notice ref={formErrorRef} variant="danger" role="alert" tabIndex={-1}>
            {formError}
          </Notice>
        )}
        {!formError && submitted && errorCount > 1 && (
          <Notice variant="danger">{t("comum:formErrorsSummary", { count: errorCount })}</Notice>
        )}
        {deleteError && (
          <Notice ref={deleteErrorRef} variant="danger" role="alert" tabIndex={-1}>
            {deleteError}
          </Notice>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-6">
          <div className="flex flex-col gap-4">
            <section className="rounded-card border border-separator bg-surface p-4 shadow-sm">
              <TextField
                id={NAME_FIELD_ID}
                label={t("cargos:fields.name")}
                autoComplete="off"
                value={name}
                maxLength={POSITION_NAME_MAX_LENGTH + 20}
                onChange={(event) => {
                  setName(event.target.value);
                  if (submitted) setNameError(validateName(event.target.value));
                }}
                error={nameError}
              />
            </section>

            <ScheduleEditor
              value={draft}
              onChange={handleDraftChange}
              errors={errors}
              today={today}
              idPrefix={ID_PREFIX}
              showEffectiveFrom={!isNew}
              disabled={saving}
            />

            {!isNew && history.length > 0 && (
              <section aria-labelledby="historico-jornada" className="rounded-card border border-separator bg-surface p-4 shadow-sm">
                <h2 id="historico-jornada" className="mb-2 text-title-sm text-text">
                  {t("cargos:history.title")}
                </h2>
                <ul className="divide-y divide-separator">
                  {history.map((version) => (
                    <li key={version.scheduleId} className="flex flex-col gap-0.5 py-2.5">
                      <span className="text-body-sm font-semibold text-text">
                        {version.effectiveFrom > today
                          ? t("cargos:history.future", { date: formatYmdNumeric(version.effectiveFrom) })
                          : t("cargos:history.from", { date: formatYmdNumeric(version.effectiveFrom) })}
                      </span>
                      <ScheduleSummary schedule={shapeFromInfo(version)} />
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <aside className="flex flex-col gap-3 rounded-card border border-separator bg-surface p-4 shadow-sm lg:sticky lg:top-6">
            <h2 className="text-title-sm text-text">{t("cargos:summary.title")}</h2>
            <ScheduleSummary schedule={shape} variant="card" />
            {!isNew && position && (
              <p className="text-body-sm text-muted">
                {t("cargos:members", { count: position.activeMembers })}
                {draft.effectiveFrom ? ` · ${t("cargos:summary.effective", { date: formatYmdNumeric(draft.effectiveFrom) })}` : ""}
              </p>
            )}
            <Button
              type="submit"
              fullWidth
              loading={saving}
              loadingText={t("comum:saving")}
              disabled={offline}
              aria-describedby={offline ? "cargo-offline" : undefined}
              icon={<Save aria-hidden="true" className="size-5" />}
            >
              {t("cargos:save")}
            </Button>
            {offline && (
              <p id="cargo-offline" className="text-caption text-muted">
                {t("comum:availableOnline")}
              </p>
            )}
            {!isNew && (
              <Button
                variant="danger-ghost"
                fullWidth
                disabled={offline || saving}
                onClick={() => {
                  setDeleteError(null);
                  setDeleteOpen(true);
                }}
                icon={<Trash2 aria-hidden="true" className="size-5" />}
              >
                {t("cargos:delete.button")}
              </Button>
            )}
          </aside>
        </div>
      </form>

      <ConfirmModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={handleDelete}
        title={t("cargos:delete.title", { name: position?.name ?? "" })}
        description={t("cargos:delete.description")}
        confirmLabel={t("cargos:delete.confirm")}
        confirmLoadingLabel={t("cargos:delete.deleting")}
        variant="danger"
      />
    </>
  );
};

export default PositionEditorPage;
