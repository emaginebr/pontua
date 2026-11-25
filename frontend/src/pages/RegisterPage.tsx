import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { UserPlus } from "lucide-react";
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
import { notifySuccess } from "../utils/notify";
import { PASSWORD_MIN_LENGTH, invalidFields, isValidEmail } from "../utils/validation";
import type { FieldErrors } from "../utils/validation";

type RegisterField = "name" | "email" | "password";
const FIELD_ORDER: readonly RegisterField[] = ["name", "email", "password"];

const readFrom = (state: unknown): string | null => {
  if (typeof state !== "object" || state === null || !("from" in state)) return null;
  const from: unknown = state.from;
  return typeof from === "string" ? from : null;
};

/**
 * Criar conta (`/cadastro`, mockup login.html; US1-1/US1-2): ao criar, a pessoa já entra.
 * Requisito de senha visível antes do erro; erros por campo, inclusive 409 de e-mail em uso.
 */
const RegisterPage = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const { register, loginWithGoogle, isAuthenticated, loading } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors<RegisterField>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [redirectTo, setRedirectTo] = useState<string | null>(null);
  const authenticating = useRef(false);
  const refs = {
    name: useRef<HTMLInputElement>(null),
    email: useRef<HTMLInputElement>(null),
    password: useRef<HTMLInputElement>(null),
  };
  const formErrorRef = useRef<HTMLDivElement>(null);
  const from = readFrom(location.state);

  useEffect(() => {
    if (formError) formErrorRef.current?.focus();
  }, [formError]);

  if (redirectTo) return <Navigate to={redirectTo} replace />;
  if (isAuthenticated && !authenticating.current) return <Navigate to="/" replace />;

  const validate = (): FieldErrors<RegisterField> => {
    const next: FieldErrors<RegisterField> = {};
    if (!name.trim()) next.name = t("auth:validation.nameRequired");
    if (!email.trim()) next.email = t("auth:validation.emailRequired");
    else if (!isValidEmail(email)) next.email = t("auth:validation.emailInvalid");
    if (!password) next.password = t("auth:validation.passwordRequired");
    else if (password.length < PASSWORD_MIN_LENGTH)
      next.password = t("auth:validation.passwordShort", { min: PASSWORD_MIN_LENGTH });
    return next;
  };

  const applyErrors = (next: FieldErrors<RegisterField>): boolean => {
    setErrors(next);
    const first = invalidFields(next, FIELD_ORDER)[0];
    if (first) refs[first].current?.focus();
    return first !== undefined;
  };

  const finish = (isNewUser: boolean) => {
    if (isNewUser) notifySuccess(t("auth:register.created"));
    setRedirectTo(resolvePostLoginPath(from));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    if (applyErrors(validate())) return;
    authenticating.current = true;
    try {
      await register({ name: name.trim(), email: email.trim(), password });
      finish(true);
    } catch (err) {
      authenticating.current = false;
      const fields = fieldErrorsOf(err);
      const apiErrors: FieldErrors<RegisterField> = {
        name: fields.name,
        email: fields.email ?? (isApiError(err) && err.status === 409 ? err.mensagem : undefined),
        password: fields.password,
      };
      if (!applyErrors(apiErrors)) setFormError(toErrorMessage(err));
    }
  };

  const handleGoogle = async (idToken: string) => {
    setFormError(null);
    authenticating.current = true;
    try {
      const result = await loginWithGoogle(idToken);
      finish(result.isNewUser);
    } catch (err) {
      authenticating.current = false;
      setFormError(isApiError(err) ? err.mensagem : t("auth:google.error"));
    }
  };

  const errorCount = invalidFields(errors, FIELD_ORDER).length;

  return (
    <PublicLayout
      headline={t("auth:brand.registerHeadline")}
      text={t("auth:brand.registerText")}
      bullets={[t("auth:brand.devices"), t("auth:brand.noInstall")]}
    >
      <PageHeader title={t("auth:register.title")} centered className="mb-0" />

      {formError && (
        <Notice ref={formErrorRef} variant="danger" role="alert" tabIndex={-1}>
          {formError}
        </Notice>
      )}

      {isGoogleSignInEnabled() && (
        <>
          <GoogleSignInButton text="signup_with" onCredential={(idToken) => void handleGoogle(idToken)} />
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
          ref={refs.name}
          label={t("auth:fields.name")}
          name="name"
          autoComplete="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={errors.name}
        />
        <TextField
          ref={refs.email}
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
          ref={refs.password}
          label={t("auth:fields.password")}
          name="password"
          autoComplete="new-password"
          revealable
          help={t("auth:fields.passwordHelp", { min: PASSWORD_MIN_LENGTH })}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={errors.password}
        />
        <Button
          type="submit"
          fullWidth
          loading={loading}
          loadingText={t("auth:register.submitting")}
          icon={<UserPlus aria-hidden="true" className="size-5" />}
        >
          {t("auth:register.submit")}
        </Button>
      </form>

      <p className="text-center text-body-sm">
        {t("auth:register.haveAccount")}{" "}
        <Link to="/entrar" state={location.state} className="font-bold text-primary underline-offset-2 hover:underline">
          {t("auth:register.login")}
        </Link>
      </p>
    </PublicLayout>
  );
};

export default RegisterPage;
