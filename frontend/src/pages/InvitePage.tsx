import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Building2, CalendarX, LogIn, SearchX, UserPlus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "../components/Button";
import { buttonClasses } from "../components/buttonStyles";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { Notice } from "../components/Notice";
import { PageHeader } from "../components/PageHeader";
import { PublicLayout } from "../components/PublicLayout";
import { useAuth } from "../hooks/useAuth";
import { useInvitations } from "../hooks/useInvitations";
import { isApiError, toErrorMessage } from "../Services/apiClient";
import { clearPendingInvite, readPendingInvite, savePendingInvite } from "../Services/authSession";
import type { InvitationPublicInfo } from "../types/invitation";
import { DEFAULT_TIME_ZONE, formatYmdNumeric, toYmdInZone } from "../utils/dateTime";
import { notifyInfo, notifySuccess } from "../utils/notify";

/** Status da API: convite expirado/revogado no aceite. */
const INVITE_UNAVAILABLE_STATUS = 422;

type LoadState = "loading" | "ready" | "notFound" | "error";

/** Estado sem formulário (convite inexistente, expirado ou revogado). */
const UnavailableInvite = ({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) => {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center gap-3 pt-4 text-center">
      <span className="grid size-[72px] place-items-center rounded-full bg-danger-soft text-danger">
        <Icon aria-hidden="true" className="size-10" strokeWidth={1.75} />
      </span>
      <PageHeader title={title} centered className="mb-0" />
      <p className="max-w-prose text-body-sm text-muted">{text}</p>
      <Link to="/" className={buttonClasses({ variant: "secondary", fullWidth: true, className: "mt-2" })}>
        {t("convites:public.goToApp")}
      </Link>
    </div>
  );
};

/**
 * Convite público (`/convite/:token`, mockup invite.html §1–2; US4, FR-021, research R-12):
 * mostra empresa e cargo; sem sessão guarda `pontua:pendingInvite` e leva a criar conta/entrar;
 * depois de autenticar (convite pendente igual a este) aceita sozinho. 409 = já é membro → abre
 * a empresa. Aceite → empresa selecionada e tela de ponto.
 */
const InvitePage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { token = "" } = useParams();
  const { isAuthenticated, user } = useAuth();
  const { getPublic, accept } = useInvitations();
  const [info, setInfo] = useState<InvitationPublicInfo | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const autoStarted = useRef(false);
  const acceptErrorRef = useRef<HTMLDivElement>(null);

  const loadInfo = useCallback(async () => {
    try {
      setState("loading");
      setLoadError(null);
      setInfo(await getPublic(token));
      setState("ready");
    } catch (err) {
      if (isApiError(err) && err.status === 404) setState("notFound");
      else {
        setLoadError(toErrorMessage(err));
        setState("error");
      }
    }
  }, [getPublic, token]);

  useEffect(() => {
    void loadInfo();
  }, [loadInfo]);

  useEffect(() => {
    if (acceptError) acceptErrorRef.current?.focus();
  }, [acceptError]);

  const doAccept = useCallback(async () => {
    setAccepting(true);
    setAcceptError(null);
    try {
      const outcome = await accept(token);
      const name = outcome.companyName ?? "";
      if (outcome.kind === "accepted") notifySuccess(t("convites:public.welcome", { name }));
      else notifyInfo(t("convites:public.alreadyMember", { name }));
      navigate("/", { replace: true });
    } catch (err) {
      setAccepting(false);
      if (isApiError(err) && (err.status === INVITE_UNAVAILABLE_STATUS || err.status === 404)) {
        // Expirou/foi revogado entre a abertura e o aceite: mostra o estado atual do convite
        await loadInfo();
        if (err.status === 404) setState("notFound");
        return;
      }
      setAcceptError(toErrorMessage(err));
    }
  }, [accept, token, navigate, t, loadInfo]);

  // Sem sessão: o convite fica guardado para depois do cadastro/login
  useEffect(() => {
    if (!isAuthenticated && token && state === "ready" && info?.status === "active") savePendingInvite(token);
  }, [isAuthenticated, token, state, info]);

  // Voltou do cadastro/login com este convite pendente: aceita sozinho (T049)
  useEffect(() => {
    if (!isAuthenticated || autoStarted.current || readPendingInvite() !== token) return;
    autoStarted.current = true;
    void doAccept();
  }, [isAuthenticated, token, doAccept]);

  // Convite indisponível não deve ser reaberto depois do login
  useEffect(() => {
    if (state === "notFound" || (state === "ready" && info && info.status !== "active")) {
      if (readPendingInvite() === token) clearPendingInvite();
    }
  }, [state, info, token]);

  const expiresOn = info ? formatYmdNumeric(toYmdInZone(info.expiresAt, DEFAULT_TIME_ZONE)) : "";

  const content = (() => {
    if (accepting) {
      return (
        <>
          <PageHeader title={t("convites:public.accepting")} centered className="mb-0" />
          <LoadingState lines={3} label={t("convites:public.accepting")} />
        </>
      );
    }
    if (state === "loading") {
      return (
        <>
          <PageHeader title={t("convites:publicTitle")} centered className="mb-0" />
          <LoadingState lines={4} />
        </>
      );
    }
    if (state === "error") {
      return (
        <>
          <PageHeader title={t("convites:publicTitle")} centered className="mb-0" />
          <ErrorState message={loadError} onRetry={() => void loadInfo()} />
        </>
      );
    }
    if (state === "notFound" || !info) {
      return (
        <UnavailableInvite icon={SearchX} title={t("convites:public.notFound")} text={t("convites:public.notFoundText")} />
      );
    }
    if (info.status === "expired") {
      return (
        <UnavailableInvite
          icon={CalendarX}
          title={t("convites:public.expired")}
          text={t("convites:public.expiredText", { company: info.companyName, date: expiresOn })}
        />
      );
    }
    if (info.status === "revoked") {
      return (
        <UnavailableInvite
          icon={CalendarX}
          title={t("convites:public.revoked")}
          text={t("convites:public.revokedText", { company: info.companyName })}
        />
      );
    }

    return (
      <>
        {/* Padding uniforme de 24 px (A-17) */}
        <div className="flex flex-col items-center gap-2 rounded-card bg-primary-soft p-6 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-surface text-primary">
            <Building2 aria-hidden="true" className="size-6" />
          </span>
          <PageHeader
            title={t("convites:public.invited", { company: info.companyName, position: info.positionName })}
            documentTitle={t("convites:publicTitle")}
            subtitle={t("convites:public.validUntil", { date: expiresOn })}
            centered
            className="mb-0 [&_h1]:text-title"
          />
        </div>

        {acceptError && (
          <Notice ref={acceptErrorRef} variant="danger" role="alert" tabIndex={-1}>
            {acceptError}
          </Notice>
        )}

        {isAuthenticated ? (
          <>
            <p className="text-center text-body-sm text-muted">
              {t("convites:public.signedInAs", { email: user?.email ?? "" })}
            </p>
            <Button fullWidth onClick={() => void doAccept()} icon={<UserPlus aria-hidden="true" className="size-5" />}>
              {t("convites:public.accept")}
            </Button>
          </>
        ) : (
          <>
            <h2 className="text-title-sm text-text">{t("convites:public.createToAccept")}</h2>
            <Link to="/cadastro" className={buttonClasses({ fullWidth: true })}>
              <UserPlus aria-hidden="true" className="size-5" />
              {t("convites:public.register")}
            </Link>
            <p className="text-center text-body-sm">
              {t("convites:public.haveAccount")}{" "}
              <Link to="/entrar" className="inline-flex min-h-touch items-center gap-1 font-bold text-primary underline-offset-2 hover:underline">
                <LogIn aria-hidden="true" className="size-4" />
                {t("convites:public.login")}
              </Link>
            </p>
          </>
        )}
      </>
    );
  })();

  return (
    <PublicLayout
      headline={t("convites:public.brandHeadline")}
      text={t("convites:public.brandText")}
      bullets={[t("auth:brand.offline"), t("convites:public.brandHistory")]}
    >
      {content}
    </PublicLayout>
  );
};

export default InvitePage;
