import { useId, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Building2, ChevronRight, Link as LinkIcon } from "lucide-react";
import { Button } from "../components/Button";
import { InstallAppButton } from "../components/InstallAppButton";
import { PageHeader } from "../components/PageHeader";
import { TextField } from "../components/TextField";
import { useAuth } from "../hooks/useAuth";
import { useCompany } from "../hooks/useCompany";
import { cn } from "../utils/cn";
import { extractInviteToken } from "../utils/invite";

const OPTION_CLASSES =
  "flex min-h-[88px] w-full items-start gap-3.5 rounded-card border border-separator bg-surface p-4 text-left text-text shadow-sm hover:bg-surface-2";

/**
 * Sem empresa (`/bem-vindo`, mockup welcome.html; US1-4): "Criar empresa" ou "Tenho um convite"
 * (aceita o link inteiro ou só o código) e o convite de instalação.
 */
const WelcomePage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { companies } = useCompany();
  const [inviteOpen, setInviteOpen] = useState(searchParams.get("convite") === "1");
  const [link, setLink] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelId = useId();

  const firstName = user?.name.trim().split(/\s+/)[0] ?? "";
  const hasCompanies = companies.length > 0;

  const openInvite = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!link.trim()) {
      setError(t("empresa:welcome.inviteRequired"));
      inputRef.current?.focus();
      return;
    }
    const token = extractInviteToken(link);
    if (!token) {
      setError(t("empresa:welcome.inviteInvalid"));
      inputRef.current?.focus();
      return;
    }
    navigate(`/convite/${encodeURIComponent(token)}`);
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={firstName ? t("empresa:welcome.greeting", { name: firstName }) : t("empresa:welcome.title")}
        documentTitle={t("empresa:welcome.title")}
        subtitle={hasCompanies ? t("empresa:welcome.leadWithCompany") : t("empresa:welcome.lead")}
        className="mb-2"
      />

      <Link to="/empresas/nova" className={OPTION_CLASSES}>
        <span className="grid size-12 shrink-0 place-items-center rounded-[14px] bg-primary-soft text-primary">
          <Building2 aria-hidden="true" className="size-6" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-title-sm">{t("empresa:welcome.createTitle")}</span>
          <span className="text-body-sm text-muted">{t("empresa:welcome.createText")}</span>
        </span>
        <ChevronRight aria-hidden="true" className="size-5 shrink-0 self-center text-muted" />
      </Link>

      <div className={cn("rounded-card", inviteOpen && "border-2 border-primary bg-surface shadow-sm")}>
        <button
          type="button"
          aria-expanded={inviteOpen}
          aria-controls={inviteOpen ? panelId : undefined}
          onClick={() => setInviteOpen((value) => !value)}
          className={cn(OPTION_CLASSES, inviteOpen && "border-0 shadow-none")}
        >
          <span className="grid size-12 shrink-0 place-items-center rounded-[14px] bg-primary-soft text-primary">
            <LinkIcon aria-hidden="true" className="size-6" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-title-sm">{t("empresa:welcome.inviteTitle")}</span>
            <span className="text-body-sm text-muted">{t("empresa:welcome.inviteText")}</span>
          </span>
          <ChevronRight
            aria-hidden="true"
            className={cn("size-5 shrink-0 self-center text-muted transition-transform", inviteOpen && "rotate-90")}
          />
        </button>
        {inviteOpen && (
          <form id={panelId} noValidate onSubmit={openInvite} className="flex flex-col gap-4 px-4 pb-4">
            <TextField
              ref={inputRef}
              label={t("empresa:welcome.inviteField")}
              name="convite"
              autoComplete="off"
              inputMode="url"
              value={link}
              onChange={(event) => {
                setLink(event.target.value);
                if (error) setError(null);
              }}
              error={error}
            />
            <Button type="submit" fullWidth>
              {t("empresa:welcome.inviteSubmit")}
            </Button>
          </form>
        )}
      </div>

      <InstallAppButton variant="card" className="mt-2" />
    </div>
  );
};

export default WelcomePage;
