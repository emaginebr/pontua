/**
 * Extrai o token de um link de convite (`…/convite/{token}`) ou de um código colado.
 * Tokens da API: base64url de 32 bytes (43 caracteres); aceita 16+ para não depender do tamanho.
 */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,}$/;
const PATH_PATTERN = /\/convite\/([A-Za-z0-9_-]{16,})(?:[/?#]|$)/;

export const extractInviteToken = (input: string): string | null => {
  const value = input.trim();
  if (!value) return null;
  const fromPath = PATH_PATTERN.exec(value);
  if (fromPath?.[1]) return fromPath[1];
  return TOKEN_PATTERN.test(value) ? value : null;
};
