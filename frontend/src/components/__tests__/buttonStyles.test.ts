import { buttonClasses } from "../buttonStyles";
import type { ButtonVariant } from "../buttonStyles";

const VARIANTS: ButtonVariant[] = [
  "primary",
  "secondary",
  "tertiary",
  "danger",
  "danger-ghost",
  "success",
  "reject",
  "google",
  "icon",
];

/** Classes de cor de borda sem prefixo de estado (`border-border`, `border-transparent`…). */
const borderColors = (classes: string): string[] =>
  classes
    .split(/\s+/)
    .filter((name) => /^border-(?!t-|b-|l-|r-|x-|y-|\d|\[)[a-z-]+$/.test(name));

const disabledFills = (classes: string): string[] =>
  classes.split(/\s+/).filter((name) => /^(aria-)?disabled:bg-/.test(name));

describe("buttonClasses — bordas (revisão T070, I-16)", () => {
  it.each(VARIANTS)("variante %s declara exatamente uma cor de borda", (variant) => {
    // `cn` só concatena: duas cores de borda no mesmo nível fariam a CSS gerada decidir
    expect(borderColors(buttonClasses({ variant }))).toHaveLength(1);
  });

  it.each([
    ["secondary", "border-border"],
    ["google", "border-border"],
    ["reject", "border-danger"],
  ] as const)("%s tem contorno visível (%s), sem border-transparent", (variant, expected) => {
    const classes = buttonClasses({ variant });
    expect(borderColors(classes)).toEqual([expected]);
    expect(classes.split(/\s+/)).not.toContain("border-transparent");
  });

  it("variante icon desabilitada não ganha fundo (components.md §0, A-09)", () => {
    expect(disabledFills(buttonClasses({ variant: "icon" }))).toEqual([]);
    expect(disabledFills(buttonClasses({ variant: "secondary" }))).toEqual([
      "disabled:bg-surface-2",
      "aria-disabled:bg-surface-2",
    ]);
  });
});
