import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MapPinOff } from "lucide-react";
import { buttonClasses } from "../components/buttonStyles";
import { EmptyState } from "../components/EmptyState";
import { PageHeader } from "../components/PageHeader";
import { SkipLink } from "../components/SkipLink";

/** Rota inexistente. */
const NotFoundPage = () => {
  const { t } = useTranslation();
  return (
    <div className="min-h-dvh bg-bg">
      <SkipLink />
      <main id="conteudo" tabIndex={-1} className="mx-auto flex max-w-form flex-col px-4 pt-10">
        <PageHeader title={t("comum:notFound.title")} hideTitle />
        <EmptyState
          icon={MapPinOff}
          title={t("comum:notFound.title")}
          description={t("comum:notFound.description")}
          action={
            <Link to="/" className={buttonClasses({ variant: "secondary" })}>
              {t("comum:notFound.action")}
            </Link>
          }
        />
      </main>
    </div>
  );
};

export default NotFoundPage;
