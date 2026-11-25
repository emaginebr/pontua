import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Building2 } from "lucide-react";
import { Button } from "../components/Button";
import { Notice } from "../components/Notice";
import { PageHeader } from "../components/PageHeader";
import { Select } from "../components/Select";
import { TextField } from "../components/TextField";
import { useCompany } from "../hooks/useCompany";
import { useConnectivity } from "../hooks/useConnectivity";
import { fieldErrorsOf, toErrorMessage } from "../Services/apiClient";
import { notifySuccess } from "../utils/notify";
import { BRAZIL_TIME_ZONES, DEFAULT_COMPANY_TIME_ZONE, timeZoneHelp } from "../utils/timeZones";
import { invalidFields } from "../utils/validation";
import type { FieldErrors } from "../utils/validation";

/** Limites de `POST /api/companies` (CompanyRules do backend). */
const COMPANY_NAME_MAX_LENGTH = 160;
const COMPANY_DOCUMENT_MAX_LENGTH = 20;

type CompanyField = "name" | "document" | "timeZone";
const FIELD_ORDER: readonly CompanyField[] = ["name", "document", "timeZone"];

/**
 * Criar empresa (`/empresas/nova`; US3-1): nome, documento opcional (só dígitos) e fuso do
 * Brasil (padrão `America/Sao_Paulo`). O criador vira responsável; a empresa é selecionada e o
 * app abre a tela de ponto.
 */
const NewCompanyPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { createCompany, companies } = useCompany();
  const { isOnline } = useConnectivity();
  const [name, setName] = useState("");
  const [document, setDocument] = useState("");
  const [timeZone, setTimeZone] = useState(DEFAULT_COMPANY_TIME_ZONE);
  const [errors, setErrors] = useState<FieldErrors<CompanyField>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const refs = {
    name: useRef<HTMLInputElement>(null),
    document: useRef<HTMLInputElement>(null),
    timeZone: useRef<HTMLSelectElement>(null),
  };
  const formErrorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (formError) formErrorRef.current?.focus();
  }, [formError]);

  const digits = document.replace(/\D/g, "");

  const validate = (): FieldErrors<CompanyField> => {
    const next: FieldErrors<CompanyField> = {};
    if (!name.trim()) next.name = t("empresa:new.errors.nameRequired");
    else if (name.trim().length > COMPANY_NAME_MAX_LENGTH)
      next.name = t("empresa:new.errors.nameLength", { max: COMPANY_NAME_MAX_LENGTH });
    if (document.trim() && (digits.length === 0 || digits.length > COMPANY_DOCUMENT_MAX_LENGTH))
      next.document = t("empresa:new.errors.document", { max: COMPANY_DOCUMENT_MAX_LENGTH });
    if (!timeZone) next.timeZone = t("empresa:new.errors.timeZone");
    return next;
  };

  const applyErrors = (next: FieldErrors<CompanyField>): boolean => {
    setErrors(next);
    const first = invalidFields(next, FIELD_ORDER)[0];
    if (first) refs[first].current?.focus();
    return first !== undefined;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    if (applyErrors(validate())) return;
    setSaving(true);
    try {
      const info = await createCompany({ name: name.trim(), document: digits || null, timeZone });
      notifySuccess(t("empresa:new.created", { name: info.name }));
      navigate("/", { replace: true });
    } catch (err) {
      const fields = fieldErrorsOf(err);
      const apiErrors: FieldErrors<CompanyField> = {
        name: fields.name,
        document: fields.document,
        timeZone: fields.timezone,
      };
      if (!applyErrors(apiErrors)) setFormError(toErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const errorCount = invalidFields(errors, FIELD_ORDER).length;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("empresa:newTitle")}
        subtitle={t("empresa:new.lead")}
        backTo={companies.length > 0 ? "/" : "/bem-vindo"}
        className="mb-2"
      />
      {formError && (
        <Notice ref={formErrorRef} variant="danger" role="alert" tabIndex={-1}>
          {formError}
        </Notice>
      )}
      <form noValidate onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-4">
        {errorCount > 1 && <Notice variant="danger">{t("comum:formErrorsSummary", { count: errorCount })}</Notice>}
        <TextField
          ref={refs.name}
          label={t("empresa:new.name")}
          name="organization"
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
          autoComplete="off"
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
          {BRAZIL_TIME_ZONES.map((zone) => (
            <option key={zone.id} value={zone.id}>
              {t(`empresa:timeZones.${zone.key}.label`)}
            </option>
          ))}
        </Select>
        <Notice variant="info">{t("empresa:new.ownerNote")}</Notice>
        <Button
          type="submit"
          fullWidth
          loading={saving}
          loadingText={t("empresa:new.submitting")}
          disabled={!isOnline}
          aria-describedby={!isOnline ? "empresa-offline" : undefined}
          icon={<Building2 aria-hidden="true" className="size-5" />}
        >
          {t("empresa:new.submit")}
        </Button>
        {!isOnline && (
          <p id="empresa-offline" className="text-caption text-muted">
            {t("comum:availableOnline")}
          </p>
        )}
      </form>
    </div>
  );
};

export default NewCompanyPage;
