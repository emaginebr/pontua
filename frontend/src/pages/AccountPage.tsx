import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LogOut } from "lucide-react";
import { Button } from "../components/Button";
import { ConfirmModal } from "../components/ConfirmModal";
import { InstallAppButton } from "../components/InstallAppButton";
import { Notice } from "../components/Notice";
import { PageHeader } from "../components/PageHeader";
import { TextField } from "../components/TextField";
import { useAuth } from "../hooks/useAuth";
import { useConnectivity } from "../hooks/useConnectivity";
import { useInstallPrompt } from "../hooks/useInstallPrompt";
import { usePunchQueue } from "../hooks/usePunchQueue";
import { fieldErrorsOf, toErrorMessage } from "../Services/apiClient";
import { notifyError, notifySuccess } from "../utils/notify";
import { PASSWORD_MIN_LENGTH, invalidFields } from "../utils/validation";
import type { FieldErrors } from "../utils/validation";

type PasswordField = "currentPassword" | "newPassword" | "confirmPassword";
const PASSWORD_ORDER: readonly PasswordField[] = ["currentPassword", "newPassword", "confirmPassword"];

const SECTION_CLASSES = "flex flex-col gap-4 rounded-card border border-separator bg-surface p-4 shadow-sm lg:p-6";

/**
 * Minha conta (`/conta`; US1, FR-007/FR-009): editar nome, trocar/definir senha (senha atual só
 * se a conta já tem senha), instalar o app e sair com confirmação.
 */
const AccountPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, updateName, updatePassword, logout } = useAuth();
  const { isOnline } = useConnectivity();
  const install = useInstallPrompt();
  // Marcações do usuário guardadas no aparelho: não são apagadas ao sair (research R-07)
  const { waiting: queuedCount } = usePunchQueue();

  const [name, setName] = useState(user?.name ?? "");
  const [nameError, setNameError] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const [passwords, setPasswords] = useState<Record<PasswordField, string>>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordErrors, setPasswordErrors] = useState<FieldErrors<PasswordField>>({});
  const [savingPassword, setSavingPassword] = useState(false);
  const passwordRefs = {
    currentPassword: useRef<HTMLInputElement>(null),
    newPassword: useRef<HTMLInputElement>(null),
    confirmPassword: useRef<HTMLInputElement>(null),
  };

  const [logoutOpen, setLogoutOpen] = useState(false);

  if (!user) return null;
  const hasPassword = user.hasPassword;

  const saveName = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError(t("auth:validation.nameRequired"));
      nameRef.current?.focus();
      return;
    }
    setNameError(null);
    setSavingName(true);
    try {
      await updateName(trimmed);
      notifySuccess(t("auth:account.nameSaved"));
    } catch (err) {
      const fieldError = fieldErrorsOf(err).name;
      if (fieldError) {
        setNameError(fieldError);
        nameRef.current?.focus();
      } else {
        notifyError(toErrorMessage(err));
      }
    } finally {
      setSavingName(false);
    }
  };

  const applyPasswordErrors = (next: FieldErrors<PasswordField>): boolean => {
    setPasswordErrors(next);
    const first = invalidFields(next, PASSWORD_ORDER)[0];
    if (first) passwordRefs[first].current?.focus();
    return first !== undefined;
  };

  const savePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next: FieldErrors<PasswordField> = {};
    if (hasPassword && !passwords.currentPassword) next.currentPassword = t("auth:validation.currentRequired");
    if (!passwords.newPassword) next.newPassword = t("auth:validation.passwordRequired");
    else if (passwords.newPassword.length < PASSWORD_MIN_LENGTH)
      next.newPassword = t("auth:validation.passwordShort", { min: PASSWORD_MIN_LENGTH });
    if (passwords.newPassword && passwords.confirmPassword !== passwords.newPassword)
      next.confirmPassword = t("auth:validation.passwordMismatch");
    if (applyPasswordErrors(next)) return;

    setSavingPassword(true);
    try {
      await updatePassword({
        currentPassword: hasPassword ? passwords.currentPassword : null,
        newPassword: passwords.newPassword,
      });
      setPasswords({ currentPassword: "", newPassword: "", confirmPassword: "" });
      notifySuccess(t("auth:account.passwordSaved"));
    } catch (err) {
      const fields = fieldErrorsOf(err);
      const apiErrors: FieldErrors<PasswordField> = {
        currentPassword: fields.currentpassword,
        newPassword: fields.newpassword,
      };
      if (!applyPasswordErrors(apiErrors)) notifyError(toErrorMessage(err));
    } finally {
      setSavingPassword(false);
    }
  };

  const setPasswordValue = (field: PasswordField, value: string) =>
    setPasswords((previous) => ({ ...previous, [field]: value }));

  const offlineHint = !isOnline && <p className="text-caption text-muted">{t("comum:availableOnline")}</p>;

  return (
    // Coluna do formulário limitada a 560 px no computador (A-21)
    <div className="flex w-full max-w-[560px] flex-col gap-6">
      <PageHeader title={t("auth:account.title")} subtitle={<span className="break-all">{user.email}</span>} />

      {!isOnline && <Notice variant="offline">{t("auth:account.offline")}</Notice>}

      <section aria-labelledby="conta-dados" className={SECTION_CLASSES}>
        <h2 id="conta-dados" className="text-title text-text">
          {t("auth:account.profileSection")}
        </h2>
        <form noValidate onSubmit={(event) => void saveName(event)} className="flex flex-col gap-4">
          <TextField
            ref={nameRef}
            label={t("auth:fields.name")}
            name="name"
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            error={nameError}
          />
          {/* Somente leitura como texto (quebra o e-mail longo em vez de cortar — I-19, §7.1) */}
          <dl className="flex flex-col gap-1.5">
            <dt className="text-label text-text">{t("auth:fields.email")}</dt>
            <dd className="rounded-md bg-surface-2 px-3.5 py-3 text-body break-all text-text">{user.email}</dd>
          </dl>
          <div className="flex flex-col gap-1 lg:flex-row lg:items-center lg:gap-3">
            <Button
              type="submit"
              loading={savingName}
              loadingText={t("comum:saving")}
              disabled={!isOnline || name.trim() === user.name}
              className="w-full lg:w-auto"
            >
              {t("auth:account.saveName")}
            </Button>
            {offlineHint}
          </div>
        </form>
      </section>

      <section aria-labelledby="conta-senha" className={SECTION_CLASSES}>
        <div className="flex flex-col gap-1">
          <h2 id="conta-senha" className="text-title text-text">
            {hasPassword ? t("auth:account.changePassword") : t("auth:account.definePassword")}
          </h2>
          {!hasPassword && <p className="text-body-sm text-muted">{t("auth:account.definePasswordHelp")}</p>}
        </div>
        <form noValidate onSubmit={(event) => void savePassword(event)} className="flex flex-col gap-4">
          {hasPassword && (
            <TextField
              ref={passwordRefs.currentPassword}
              label={t("auth:account.currentPassword")}
              name="currentPassword"
              autoComplete="current-password"
              revealable
              value={passwords.currentPassword}
              onChange={(event) => setPasswordValue("currentPassword", event.target.value)}
              error={passwordErrors.currentPassword}
            />
          )}
          <TextField
            ref={passwordRefs.newPassword}
            label={t("auth:account.newPassword")}
            name="newPassword"
            autoComplete="new-password"
            revealable
            help={t("auth:fields.passwordHelp", { min: PASSWORD_MIN_LENGTH })}
            value={passwords.newPassword}
            onChange={(event) => setPasswordValue("newPassword", event.target.value)}
            error={passwordErrors.newPassword}
          />
          <TextField
            ref={passwordRefs.confirmPassword}
            label={t("auth:account.confirmPassword")}
            name="confirmPassword"
            autoComplete="new-password"
            revealable
            value={passwords.confirmPassword}
            onChange={(event) => setPasswordValue("confirmPassword", event.target.value)}
            error={passwordErrors.confirmPassword}
          />
          <div className="flex flex-col gap-1 lg:flex-row lg:items-center lg:gap-3">
            <Button
              type="submit"
              loading={savingPassword}
              loadingText={t("comum:saving")}
              disabled={!isOnline}
              className="w-full lg:w-auto"
            >
              {t("auth:account.savePassword")}
            </Button>
            {offlineHint}
          </div>
        </form>
      </section>

      {install.canInstall && (
        <section aria-labelledby="conta-app" className={SECTION_CLASSES}>
          <div className="flex flex-col gap-1">
            <h2 id="conta-app" className="text-title text-text">
              {t("auth:account.appSection")}
            </h2>
            <p className="text-body-sm text-muted">{t("pwa:install.text")}</p>
          </div>
          <InstallAppButton variant="item" />
        </section>
      )}

      <section aria-labelledby="conta-sair" className={SECTION_CLASSES}>
        <h2 id="conta-sair" className="sr-only">
          {t("auth:account.logout")}
        </h2>
        <Button
          variant="danger-ghost"
          icon={<LogOut aria-hidden="true" className="size-5" />}
          onClick={() => setLogoutOpen(true)}
          className="self-start"
        >
          {t("auth:account.logout")}
        </Button>
      </section>

      <ConfirmModal
        open={logoutOpen}
        onOpenChange={setLogoutOpen}
        variant="danger"
        title={t("auth:account.logoutTitle")}
        description={t("auth:account.logoutDescription")}
        confirmLabel={t("auth:account.logoutConfirm")}
        onConfirm={() => {
          logout();
          navigate("/entrar", { replace: true });
        }}
      >
        {queuedCount > 0 && (
          <Notice variant="warning">{t("auth:account.logoutQueued", { count: queuedCount })}</Notice>
        )}
      </ConfirmModal>
    </div>
  );
};

export default AccountPage;
