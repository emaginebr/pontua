import { cn } from "../utils/cn";
import { initialsOf } from "../utils/speech";

export interface AvatarProps {
  name: string;
  /** 40 px (lista) ou 56 px (detalhe) */
  size?: "md" | "lg";
  inactive?: boolean;
  className?: string;
}

/** Iniciais em círculo (components.md §11); decorativo — o nome está ao lado. */
export const Avatar = ({ name, size = "md", inactive = false, className }: AvatarProps) => (
  <span
    aria-hidden="true"
    className={cn(
      "grid shrink-0 place-items-center rounded-full font-extrabold",
      size === "lg" ? "size-14 text-[1.0625rem]" : "size-10 text-caption",
      inactive ? "bg-neutral-soft text-neutral" : "bg-primary-soft text-primary",
      className,
    )}
  >
    {initialsOf(name)}
  </span>
);

export default Avatar;
