import { useId } from "react";
import { cn } from "../utils/cn";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  /** Rótulo do grupo (`aria-label`) */
  label: string;
  value: T;
  options: Array<SegmentedOption<T>>;
  onChange: (value: T) => void;
  className?: string;
}

/**
 * Controle segmentado (components.md §4.3): grupo de rádios nativos estilizados — setas do
 * teclado trocam a opção, o leitor de tela anuncia "1 de 3".
 */
export const SegmentedControl = <T extends string>({ label, value, options, onChange, className }: SegmentedControlProps<T>) => {
  const name = useId();
  return (
    <div role="radiogroup" aria-label={label} className={cn("flex gap-1 rounded-control bg-surface-2 p-1", className)}>
      {options.map((option) => {
        const checked = option.value === value;
        return (
          <label
            key={option.value}
            className={cn(
              // Rótulo numa linha só; abaixo de 400 px, texto `body-sm` e menos recuo (A-11)
              "relative grid min-h-touch flex-auto cursor-pointer place-items-center rounded-[9px] px-2 text-center text-[0.9375rem] whitespace-nowrap",
              "max-[399px]:px-1.5 max-[399px]:text-body-sm",
              "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus",
              checked ? "bg-surface font-bold text-text shadow-sm" : "font-semibold text-muted",
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={checked}
              onChange={() => onChange(option.value)}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
            {option.label}
          </label>
        );
      })}
    </div>
  );
};

export default SegmentedControl;
