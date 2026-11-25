import { cn } from "../utils/cn";

/** Classes de campo de formulário (components.md §7.1), compartilhadas por TextField e Select. */
export const fieldInputClasses = (hasError: boolean, readOnly = false): string =>
  cn(
    "w-full min-h-control rounded-control bg-surface text-body text-text placeholder:text-subtle",
    "disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-disabled",
    hasError ? "border-2 border-danger px-[13px] py-[10px]" : "border border-border px-3.5 py-[11px]",
    readOnly && !hasError && "border-separator bg-surface-2",
  );
