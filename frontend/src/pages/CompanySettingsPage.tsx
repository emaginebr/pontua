import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeftRight, Save } from "lucide-react";
import { Button } from "../components/Button";
import { ConfirmModal } from "../components/ConfirmModal";
import { Notice } from "../components/Notice";
import { PageHeader } from "../components/PageHeader";
import { Select } from "../components/Select";
import { TextField } from "../components/TextField";
import { useCompany } from "../hooks/useCompany";
import { useConnectivity } from "../hooks/useConnectivity";
import { useMembers } from "../hooks/useMembers";
import { fieldErrorsOf, toErrorMessage } from "../Services/apiClient";
import type { MemberInfo } from "../types/member";
import { notifyError, notifySuccess } from "../utils/notify";
import { BRAZIL_TIME_ZONES, findBrazilTimeZone, timeZoneHelp } from "../utils/timeZones";
import { invalidFields } from "../utils/validation";
import type { FieldErrors } from "../utils/validation";

const COMPANY_NAME_MAX_LENGTH = 160;
const COMPANY_DOCUMENT_MAX_LENGTH = 20;
const RETRO_MIN = 1;
const RETRO_MAX = 365;

type SettingsField = "name" | "document" | "timeZone" | "manualRetroDays";
const FIELD_ORDER: readonly SettingsField[] = ["name", "document", "timeZone", "manualRetroDays"];

const SECTION_BASE = "flex flex-col gap-4 rounded-card border bg-surface p-4 shadow-sm lg:p-6";
const SECTION = `${SECTION_BASE} border-separator`;
/** Zona de transferência: borda vermelha (mockup settings.html §3) */
const DANGER_SECTION = `${SECTION_BASE} border-danger`;

/**
 * Configurações da empresa (`/empresa/configuracoes`, mockup settings.html §3–4; US7, FR-020):
 * nome, documento, fuso, limite de dias da marcação manual (1–365) e transferência da
 * responsabilidade com confirmação explícita (digitar o nome do novo responsável).
 */
const CompanySettingsPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { activeCompany, updateCompany, transferOwnership, refresh } = useCompany();
  const { isOnline } = useConnectivity();
  const { members, load: loadMembers, loading: membersLoading } = useMembers();
  const offline = !isOnline;

  const [name, setName] = useState(activeCompany?.name ?? "");
  const [document, setDocument] = useState(activeCompany?.document ?? "");
  const [timeZone, setTimeZone] = useState(activeCompany?.timeZone ?? "");
  const [retroDays, setRetroDays] = useState(String(activeCompany?.manualRetroDays ?? 30));
  const [errors, setErrors] = useState<FieldErrors<SettingsField>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [targetId, setTargetId] = useState("");
  const [targetError, setTargetError] = useState<string | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const refs = {
    name: useRef<HTMLInputElement>(null),
    document: useRef<HTMLInputElement>(null),
    timeZone: useRef<HTMLSelectElement>(null),
    manualRetroDays: useRef<HTMLInputElement>(null),
  };
  const targetRef = useRef<HTMLSelectElement>(null);
  const [formCompanyId, setFormCompanyId] = useState<number | null>(activeCompany?.companyId ?? null);

  // Empresa carregada depois da montagem (ou trocada): o formulário recebe os dados dela
  if (activeCompany && formCompanyId !== activeCompany.companyId) {
    setFormCompanyId(activeCompany.companyId);
    setName(activeCompany.name);
    setDocument(activeCompany.document ?? "");
    setTimeZone(activeCompany.timeZone);
    setRetroDays(String(activeCompany.manualRetroDays));
    setErrors({});
  }

  useEffect(() => {
    void loadMembers("active");
  }, [loadMembers]);

  if (!activeCompany) return null;

  const myMemberId = activeCompany.myAccess.memberId;
  const candidates = members.filter((member) => member.status === "active" && member.memberId !== myMemberId);
  const target: MemberInfo | undefined = candidates.find((member) => String(member.memberId) === targetId);
  const digits = document.replace(/\D/g, "");
  const knownZone = findBrazilTimeZone(timeZone);

  const validate = (): FieldErrors<SettingsField> => {
    const next: FieldErrors<SettingsField> = {};
    if (!name.trim()) next.name = t("empresa:new.errors.nameRequired");
    else if (name.trim().length > COMPANY_NAME_MAX_LENGTH)
      next.name = t("empresa:new.errors.nameLength", { max: COMPANY_NAME_MAX_LENGTH });
    if (document.trim() && (digits.length === 0 || digits.length > COMPANY_DOCUMENT_MAX_LENGTH))
      next.document = t("empresa:new.errors.document", { max: COMPANY_DOCUMENT_MAX_LENGTH });
    if (!timeZone) next.timeZone = t("empresa:new.errors.timeZone");
    const retro = Number(retroDays);
    if (!Number.isInteger(retro) || retro < RETRO_MIN || retro > RETRO_MAX)
      next.manualRetroDays = t("empresa:settings.errors.retro", { min: RETRO_MIN, max: RETRO_MAX });
    return next;
  };

  const applyErrors = (next: FieldErrors<SettingsField>): boolean => {
    setErrors(next);
    const first = invalidFields(next, FIELD_ORDER)[0];
    if (first) refs[first].current?.focus();
    return first !== undefined;
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    if (applyErrors(validate())) return;
    setSaving(true);
    try {
      await updateCompany({
        name: name.trim(),
        document: digits || null,
        timeZone,
        manualRetroDays: Number(retroDays),
      });
      notifySuccess(t("empresa:settings.saved"));
    } catch (err) {
      const fields = fieldErrorsOf(err);
      const apiErrors: FieldErrors<SettingsField> = {
        name: fields.name,
        document: fields.document,
        timeZone: fields.timezone,
        manualRetroDays: fields.manualretrodays,
      };
      if (!applyErrors(apiErrors)) setFormError(toErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const openTransfer = () => {
    if (!target) {
      setTargetError(t("empresa:transfer.errors.target"));
      targetRef.current?.focus();
      return;
    }
    setTargetError(null);
    setTransferOpen(true);
  };

  const handleTransfer = async () => {
    if (!target) return;
    try {
      await transferOwnership(target.memberId);
    } catch (err) {
      notifyError(toErrorMessage(err));
      throw err;
    }
    notifySuccess(t("empresa:transfer.done", { name: target.name }));
    // Sai da tela do responsável antes de aplicar o novo papel e então recarrega a empresa
    navigate("/empresa", { replace: true });
    void refresh();
  };

  const errorCount = invalidFields(errors, FIELD_ORDER).length;
  const firstName = target?.name.split(" ")[0] ?? "";

  return (
    <>
      <PageHeader title={t("empresa:settingsTitle")} subtitle={activeCompany.name} backTo="/empresa" />
      {offline && <Notice variant="offline" className="mb-4">{t("empresa:settings.offline")}</Notice>}

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start lg:gap-6">
        <form noValidate onSubmit={(event) => void handleSave(event)} aria-labelledby="config-dados" className={SECTION}>
          <h2 id="config-dados" className="text-title-sm text-text">
            {t("empresa:settings.dataTitle")}
          </h2>
          {formError && (
            <Notice variant="danger" role="alert">
              {formError}
            </Notice>
          )}
          {!formError && errorCount > 1 && (
            <Notice variant="danger">{t("comum:formErrorsSummary", { count: errorCount })}</Notice>
          )}
          <TextField
            ref={refs.name}
            label={t("empresa:new.name")}
            autoComplete="organization"
            value={name}
            onChange={(event) => setName(event.target.value)}
            error={errors.name}
          />
          <TextField
            ref={refs.document}
            label={t("empresa:new.document")}
            optional
            inputMode="numeric"
            placeholder={t("empresa:new.documentPlaceholder")}
            help={t("empresa:new.documentHelp")}
            value={document}
            onChange={(event) => setDocument(event.target.value)}
            error={errors.document}
          />
          <Select
            ref={refs.timeZone}
            label={t("empresa:new.timeZone")}
            help={timeZoneHelp(t, timeZone)}
            value={timeZone}
            onChange={(event) => setTimeZone(event.target.value)}
            error={errors.timeZone}
          >
            {!knownZone && timeZone && <option value={timeZone}>{timeZone}</option>}
            {BRAZIL_TIME_ZONES.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {t(`empresa:timeZones.${zone.key}.label`)}
              </option>
            ))}
          </Select>
          <TextField
            ref={refs.manualRetroDays}
            label={t("empresa:settings.retro")}
            type="number"
            inputMode="numeric"
            min={RETRO_MIN}
            max={RETRO_MAX}
            help={t("empresa:settings.retroHelp", { count: Number(retroDays) || 0, min: RETRO_MIN, max: RETRO_MAX })}
            value={retroDays}
            onChange={(event) => setRetroDays(event.target.value)}
            error={errors.manualRetroDays}
            className="max-w-40"
          />
          <Button
            type="submit"
            fullWidth
            loading={saving}
            loadingText={t("comum:saving")}
            disabled={offline}
            icon={<Save aria-hidden="true" className="size-5" />}
          >
            {t("empresa:settings.save")}
          </Button>
        </form>

        <section aria-labelledby="config-transferir" className={DANGER_SECTION}>
          <h2 id="config-transferir" className="text-title-sm text-text">
            {t("empresa:transfer.title")}
          </h2>
          <p className="text-body-sm text-muted">{t("empresa:transfer.text", { company: activeCompany.name })}</p>
          <Select
            ref={targetRef}
            label={t("empresa:transfer.target")}
            value={targetId}
            onChange={(event) => {
              setTargetId(event.target.value);
              setTargetError(null);
            }}
            error={targetError}
            help={
              membersLoading && candidates.length === 0
                ? t("comum:loading")
                : !membersLoading && candidates.length === 0
                  ? t("empresa:transfer.noCandidates")
                  : undefined
            }
          >
            <option value="">{t("empresa:transfer.targetPlaceholder")}</option>
            {candidates.map((member) => (
              <option key={member.memberId} value={member.memberId}>
                {member.position ? `${member.name} — ${member.position.name}` : member.name}
              </option>
            ))}
          </Select>
          <Button
            variant="reject"
            fullWidth
            disabled={offline || candidates.length === 0}
            onClick={openTransfer}
            icon={<ArrowLeftRight aria-hidden="true" className="size-5" />}
          >
            {t("empresa:transfer.button")}
          </Button>
        </section>
      </div>

      <ConfirmModal
        open={transferOpen}
        onOpenChange={setTransferOpen}
        onConfirm={handleTransfer}
        title={t("empresa:transfer.confirmTitle", { name: target?.name ?? "" })}
        confirmLabel={t("empresa:transfer.confirm")}
        confirmLoadingLabel={t("empresa:transfer.transferring")}
        variant="danger"
        requireText={target?.name ?? ""}
        requireTextLabel={t("empresa:transfer.typeName", { name: target?.name ?? "" })}
      >
        <Notice variant="warning">
          <strong className="font-bold">{t("empresa:transfer.consequencesTitle")}</strong>
          <ul className="mt-1 list-disc pl-5">
            <li>{t("empresa:transfer.consequence1", { name: firstName, company: activeCompany.name })}</li>
            <li>{t("empresa:transfer.consequence2")}</li>
            <li>{t("empresa:transfer.consequence3", { name: firstName })}</li>
          </ul>
        </Notice>
      </ConfirmModal>
    </>
  );
};

export default CompanySettingsPage;
