/** Validações de formulário que só orientam o usuário (a API é a validação final). */

/** Senha mínima da API (`POST /api/auth/register`). */
export const PASSWORD_MIN_LENGTH = 8;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** E-mail com formato plausível. */
export const isValidEmail = (value: string): boolean => EMAIL_PATTERN.test(value.trim());

/** Mapa de erros por campo. */
export type FieldErrors<K extends string> = Partial<Record<K, string>>;

/** Campos com erro, na ordem informada. */
export const invalidFields = <K extends string>(errors: FieldErrors<K>, order: readonly K[]): K[] =>
  order.filter((key) => Boolean(errors[key]));
