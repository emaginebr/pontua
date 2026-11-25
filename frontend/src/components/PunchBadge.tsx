import { useTranslation } from "react-i18next";
import {
  Ban,
  CircleCheck,
  CircleX,
  CloudOff,
  CloudUpload,
  Hourglass,
  PenLine,
  Plus,
  TriangleAlert,
  Undo2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { PunchInfo, QueueState } from "../types/punch";
import { cn } from "../utils/cn";

type BadgeTone = "primary" | "offline" | "warning" | "success" | "danger" | "neutral";

const TONES: Record<BadgeTone, string> = {
  primary: "bg-primary-soft text-primary",
  offline: "bg-offline-soft text-offline",
  warning: "bg-warning-soft text-warning",
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger",
  neutral: "bg-neutral-soft text-neutral",
};

interface BadgeSpec {
  key: string;
  icon: LucideIcon;
  tone: BadgeTone;
}

export interface PunchBadgeProps {
  /** Marcação do servidor (tipo + status + período) */
  punch?: Pick<PunchInfo, "kind" | "status" | "periodName"> | null;
  /** Estado da marcação na fila local (prevalece sobre `punch`) */
  queueState?: QueueState | null;
  /** Mostra o selo "Extra" quando a marcação efetiva não tem período */
  showExtra?: boolean;
  className?: string;
}

/** Marcação efetiva sem período previsto = "Extra". */
const isExtraPunch = (punch: Pick<PunchInfo, "status" | "periodName">): boolean =>
  punch.periodName === null && (punch.status === "valid" || punch.status === "pending" || punch.status === "approved");

/** Selos de uma marcação. */
const punchBadgeSpecs = (
  punch: Pick<PunchInfo, "kind" | "status" | "periodName"> | null | undefined,
  queueState: QueueState | null | undefined,
  showExtra: boolean,
): BadgeSpec[] => {
  if (queueState === "waiting" || queueState === "sending") return [{ key: "queued", icon: CloudUpload, tone: "offline" }];
  if (queueState === "rejected") return [{ key: "queueRejected", icon: TriangleAlert, tone: "danger" }];
  if (!punch) return [];
  const specs: BadgeSpec[] = [];
  // "Extra" só sem outro selo de tipo (manual/offline): máximo de dois selos (components.md §3.1, A-07)
  if (showExtra && punch.kind === "normal" && isExtraPunch(punch)) specs.push({ key: "extra", icon: Plus, tone: "neutral" });
  if (punch.kind === "manual") specs.push({ key: "manual", icon: PenLine, tone: "primary" });
  if (punch.kind === "offline") specs.push({ key: "offline", icon: CloudOff, tone: "offline" });
  switch (punch.status) {
    case "pending":
      specs.push({ key: "pending", icon: Hourglass, tone: "warning" });
      break;
    case "approved":
      specs.push({ key: "approved", icon: CircleCheck, tone: "success" });
      break;
    case "rejected":
      specs.push({ key: "rejected", icon: CircleX, tone: "danger" });
      break;
    case "cancelled":
      specs.push({ key: "cancelled", icon: Ban, tone: "neutral" });
      break;
    case "superseded":
      specs.push({ key: "superseded", icon: Undo2, tone: "neutral" });
      break;
    case "valid":
      break;
  }
  return specs;
};

/**
 * Selo de tipo + status da marcação (components.md §3.1): texto real (lido pelo leitor de tela:
 * "Manual, Pendente"), ícone decorativo, cor complementar.
 */
export const PunchBadge = ({ punch, queueState, showExtra = true, className }: PunchBadgeProps) => {
  const { t } = useTranslation();
  const specs = punchBadgeSpecs(punch, queueState, showExtra);
  if (specs.length === 0) return null;
  return (
    <span className={cn("flex flex-wrap gap-1", className)}>
      {specs.map(({ key, icon: Icon, tone }) => (
        <span
          key={key}
          className={cn("inline-flex h-6 items-center gap-1 rounded-sm px-2 text-caption font-semibold", TONES[tone])}
        >
          <Icon aria-hidden="true" className="size-3.5 shrink-0" />
          {t(`ponto:badges.${key}`)}
        </span>
      ))}
    </span>
  );
};

export default PunchBadge;
