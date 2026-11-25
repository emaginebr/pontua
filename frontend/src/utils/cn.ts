/** Junta classes CSS ignorando valores falsos. */
export const cn = (...classes: Array<string | false | null | undefined>): string =>
  classes.filter((value): value is string => typeof value === "string" && value.length > 0).join(" ");

export default cn;
