import { useTranslation } from "react-i18next";
import { Clock, CloudOff, Hourglass, LoaderCircle } from "lucide-react";
import { cn } from "../utils/cn";

export interface PunchButtonProps {
  /** Linha abaixo do rótulo ("Retorno · previsto 13:00") */
  periodLine: string;
  /**
   * Complemento só para leitor de tela, lido DEPOIS do texto visível (sem `aria-label`, o nome
   * acessível é o próprio texto do botão — WCAG 2.5.3, I-06)
   */
  srHint?: string | null;
  onPress: () => void;
  /** Registro em andamento */
  loading?: boolean;
  /** Segundos que faltam para poder marcar de novo (< 1 min da anterior) */
  waitSeconds?: number | null;
  /** Sem conexão: selo "Sem conexão" (o registro vai para a fila) */
  offline?: boolean;
  /** Próxima marcação prevista dentro de ±10 min: halo pulsante (sem pulso com movimento reduzido) */
  pulse?: boolean;
  /** Progresso do dia (anel decorativo) */
  progress?: { done: number; total: number } | null;
}

const RING_RADIUS = 46;

/**
 * Botão de ponto (components.md §2.2): círculo de 184 px (216 px ≥ 1024 px), anel de progresso
 * decorativo, estados carregando, aguarde (`aria-disabled`, texto a cada 5 s) e sem conexão.
 */
export const PunchButton = ({
  periodLine,
  srHint = null,
  onPress,
  loading = false,
  waitSeconds = null,
  offline = false,
  pulse = false,
  progress = null,
}: PunchButtonProps) => {
  const { t } = useTranslation();
  const waiting = waitSeconds !== null && waitSeconds > 0;
  const blocked = waiting || loading;
  const percent =
    progress && progress.total > 0 ? Math.min(100, Math.round((progress.done / progress.total) * 100)) : null;

  return (
    <div className="relative grid size-[calc(var(--pt-punch-size)+28px)] place-items-center">
      {percent !== null && (
        <svg aria-hidden="true" viewBox="0 0 100 100" className="absolute inset-0 size-full -rotate-90">
          <circle cx="50" cy="50" r={RING_RADIUS} fill="none" strokeWidth="3.5" className="stroke-surface-3" />
          <circle
            cx="50"
            cy="50"
            r={RING_RADIUS}
            fill="none"
            strokeWidth="3.5"
            pathLength={100}
            strokeDasharray={`${percent} 100`}
            strokeLinecap="round"
            className="stroke-brand-green"
          />
        </svg>
      )}
      <button
        type="button"
        // Sem `aria-label`: o nome acessível é o texto visível na ordem do DOM ("Registrar ponto
        // Pausa · previsto 12:00", "Aguarde 45 s para marcar de novo") + complemento `sr-only` no
        // fim — WCAG 2.5.3 e `label-content-name-mismatch` do Lighthouse (I-06)
        aria-disabled={blocked || undefined}
        aria-busy={loading || undefined}
        onClick={() => {
          if (!blocked) onPress();
        }}
        className={cn(
          "relative flex size-punch flex-col items-center justify-center rounded-full p-4 text-center",
          // Com o selo "Sem conexão" o vão vertical cai de 8 para 4 px (I-03)
          offline && !waiting ? "gap-1" : "gap-1.5",
          "transition-[background-color,box-shadow,transform] duration-(--pt-duration-fast) focus-visible:outline-offset-[18px]",
          waiting
            ? "cursor-not-allowed bg-surface-2 text-text shadow-[inset_0_0_0_1px_var(--pt-border)]"
            : cn(
                "bg-primary bg-[radial-gradient(circle_at_50%_30%,#1765ab_0%,var(--pt-primary)_60%)] text-on-primary shadow-punch",
                "hover:bg-none hover:bg-primary-hover active:scale-[0.97] active:bg-none active:bg-primary-pressed motion-reduce:active:scale-100",
                loading && "cursor-progress",
              ),
          pulse && !blocked && "motion-safe:animate-punch-pulse",
        )}
      >
        {loading ? (
          <LoaderCircle aria-hidden="true" className="size-10 animate-spin motion-reduce:animate-none" />
        ) : waiting ? (
          <Hourglass aria-hidden="true" className="size-10" />
        ) : (
          <Clock aria-hidden="true" className="size-10" />
        )}
        <span className="text-punch">
          {loading
            ? t("ponto:button.registering")
            : waiting
              ? t("ponto:button.wait", { seconds: waitSeconds })
              : t("ponto:button.label")}
        </span>{" "}
        {/* Texto limitado a 74 % do diâmetro útil para não encostar na borda do círculo (I-03) */}
        {waiting ? (
          <span className="max-w-[136px] text-[0.875rem] leading-[1.125rem] font-semibold text-balance text-muted">
            {t("ponto:button.waitHint")}
          </span>
        ) : (
          <span className="max-w-[136px] text-[0.875rem] leading-[1.125rem] font-semibold text-balance text-[#d6e6f6]">
            {periodLine}
          </span>
        )}
        {/* Selo no topo do círculo (`order-first`), mas depois do rótulo no DOM: o nome acessível
            começa por "Registrar ponto" */}
        {offline && !waiting && (
          <>
            {" "}
            <span className="order-first inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[0.75rem] font-bold">
              <CloudOff aria-hidden="true" className="size-3.5" />
              {t("ponto:button.offlineTag")}
            </span>
          </>
        )}
        {srHint && !waiting && !loading && <span className="sr-only">{srHint}</span>}
      </button>
    </div>
  );
};

export default PunchButton;
