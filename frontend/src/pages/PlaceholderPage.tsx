import { useTranslation } from "react-i18next";
import { Hammer } from "lucide-react";
import { EmptyState } from "../components/EmptyState";
import { PageHeader } from "../components/PageHeader";

export interface PlaceholderPageProps {
  /** Chave i18n do título da tela (ex.: `historico:title`) */
  titleKey: string;
  /** Rota de volta (telas de detalhe) */
  backTo?: string;
}

/** Tela de uma história futura (US2+): mantém a rota e a navegação funcionando. */
const PlaceholderPage = ({ titleKey, backTo }: PlaceholderPageProps) => {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader title={t(titleKey)} backTo={backTo} />
      <EmptyState
        icon={Hammer}
        title={t("comum:placeholder.title")}
        description={t("comum:placeholder.description")}
      />
    </>
  );
};

export default PlaceholderPage;
