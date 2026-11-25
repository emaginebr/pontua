import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LogIn } from "lucide-react";
import { Button } from "../components/Button";
import { GoogleSignInButton } from "../components/GoogleSignInButton";
import { Notice } from "../components/Notice";
import { PageHeader } from "../components/PageHeader";
import { PublicLayout } from "../components/PublicLayout";
import { TextField } from "../components/TextField";
import { useAuth } from "../hooks/useAuth";
import { fieldErrorsOf, isApiError, toErrorMessage } from "../Services/apiClient";
import { resolvePostLoginPath } from "../Services/authSession";
import { isGoogleSignInEnabled } from "../utils/google";
import { invalidFields, isValidEmail } from "../utils/validation";
import type { FieldErrors } from "../utils/validation";

type LoginField = "email" | "password";
const FIELD_ORDER: readonly LoginField[] = ["email", "password"];

/** Estado de navegação deixado pelo guard `RequireAuth`. */
export interface AuthRedirectState {
  from?: string;
}

const readFrom = (state: unknown): string | null => {
  if (typeof state !== "object" || state === null) return null;
  const from = (state as AuthRedirectState).from;
  return typeof from === "string" ? from : null;
};

/**
 * Entrar (`/entrar`, mockup login.html; US1, FR-007/FR-008): Google primeiro, depois e-mail e
 * senha; erros por campo (inclusive `erros[]` da API); depois de entrar vai para o convite
 * pendente, a rota pedida (`returnTo`) ou o ponto.
 */
const LoginPage = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const { login, loginWithGoogle, isAuthenticated, loading, sessionExpired } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors<LoginField>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [redirectTo, setRedirectTo] = useState<string | null>(null);
  const authenticating = useRef(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const formErrorRef = useRef<HTMLDivElement>(null);
  const from = readFrom(location.state);

  useEffect(() => {
    if (formError) formErrorRef.current?.focus();
  }, [formError]);

  if (redirectTo) return <Navigate to={redirectTo} replace />;
  if (isAuthenticated && !authenticating.current) return <Navigate to="/" replace />;

  const validate = (): FieldErrors<LoginField> => {
    const next: FieldErrors<LoginField> = {};
    if (!email.trim()) next.email = t("auth:validation.emailRequired");
    else if (!isValidEmail(email)) next.email = t("auth:validation.emailInvalid");
    if (!password) next.password = t("auth:validation.passwordRequired");
    return next;
  };

  const focusField = (field: LoginField) => (field === "email" ? emailRef : passwordRef).current?.focus();

  const finish = () => setRedirectTo(resolvePostLoginPath(from));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    const next = validate();
    setErrors(next);
    const invalid = invalidFields(next, FIELD_ORDER);
    if (invalid[0]) {
      focusField(invalid[0]);
      return;
    }
    authenticating.current = true;
    try {
      await login({ email: email.trim(), password });
      finish();
    } catch (err) {
      authenticating.current = false;
      const fields = fieldErrorsOf(err);
      const apiErrors: FieldErrors<LoginField> = { email: fields.email, password: fields.password };
      setErrors(apiErrors);
      const firstInvalid = invalidFields(apiErrors, FIELD_ORDER)[0];
      if (firstInvalid) focusField(firstInvalid);
      else setFormError(toErrorMessage(err));
    }
  };

  const handleGoogle = async (idToken: string) => {
    setFormError(null);
    authenticating.current = true;
    try {
      await loginWithGoogle(idToken);
      finish();
    } catch (err) {
      authenticating.current = false;
      setFormError(isApiError(err) ? err.mensagem : t("auth:google.error"));
    }
  };

  const errorCount = invalidFields(errors, FIELD_ORDER).length;
  const googleEnabled = isGoogleSignInEnabled();

  return (
    <PublicLayout
      headline={t("auth:brand.loginHeadline")}
      text={t("auth:brand.loginText")}
      bullets={[t("auth:brand.offline"), t("auth:brand.manual"), t("auth:brand.install")]}
    >
      {sessionExpired && (
        <Notice variant="info">
          <strong className="font-bold">{t("auth:login.sessionExpiredStrong")}</strong> {t("auth:login.sessionExpiredText")}
        </Notice>
      )}
      <PageHeader title={t("auth:login.title")} subtitle={t("auth:login.lead")} centered className="mb-0" />

      {formError && (
        <Notice ref={formErrorRef} variant="danger" role="alert" tabIndex={-1}>
          {formError}
        </Notice>
      )}

      {googleEnabled && (
        <>
          <GoogleSignInButton text="signin_with" onCredential={(idToken) => void handleGoogle(idToken)} />
          <div className="flex items-center gap-3 text-body-sm text-muted before:h-px before:flex-1 before:bg-separator after:h-px after:flex-1 after:bg-separator">
            {t("auth:divider")}
          </div>
        </>
      )}

      <form noValidate onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-4">
        {errorCount > 1 && (
          <Notice variant="danger">{t("comum:formErrorsSummary", { count: errorCount })}</Notice>
        )}
        <TextField
          ref={emailRef}
          label={t("auth:fields.email")}
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          placeholder={t("auth:fields.emailPlaceholder")}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={errors.email}
        />
        <TextField
          ref={passwordRef}
          label={t("auth:fields.password")}
          name="password"
          autoComplete="current-password"
          revealable
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={errors.password}
        />
        <Button
          type="submit"
          fullWidth
          loading={loading}
          loadingText={t("auth:login.submitting")}
          icon={<LogIn aria-hidden="true" className="size-5" />}
        >
          {t("auth:login.submit")}
        </Button>
      </form>

      <p className="text-center text-body-sm">
        {t("auth:login.noAccount")}{" "}
        <Link to="/cadastro" state={location.state} className="font-bold text-primary underline-offset-2 hover:underline">
          {t("auth:login.createAccount")}
        </Link>
      </p>
      <p className="text-center text-caption text-muted">{t("auth:login.inviteHint")}</p>
    </PublicLayout>
  );
};

export default LoginPage;
