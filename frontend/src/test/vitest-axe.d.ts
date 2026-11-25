import "vitest";
import type { AxeMatchers } from "vitest-axe/matchers";

// `vitest-axe/extend-expect` registra o matcher em runtime, mas tipa o namespace antigo `Vi`;
// esta declaração expõe `toHaveNoViolations` no `expect` do Vitest 3.
declare module "vitest" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
  interface Assertion<T = any> extends AxeMatchers {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface AsymmetricMatchersContaining extends AxeMatchers {}
}
