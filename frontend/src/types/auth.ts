/** Tipos de conta e sessão (API › Auth). */

/** Dados públicos da conta. */
export interface UserInfo {
  userId: number;
  name: string;
  email: string;
  /** A conta já tem senha (troca exige a senha atual) */
  hasPassword: boolean;
  /** A conta está ligada a um login Google */
  hasGoogle: boolean;
}

/** Resultado de cadastro/entrada. */
export interface AuthResult {
  /** JWT da API */
  token: string;
  /** Expiração do token (ISO UTC) */
  expiresAt: string;
  /** Conta criada nesta requisição */
  isNewUser: boolean;
  user: UserInfo;
}

/** `POST /api/auth/register` */
export interface RegisterInput {
  name: string;
  email: string;
  /** Mínimo de 8 caracteres */
  password: string;
}

/** `POST /api/auth/login` */
export interface LoginInput {
  email: string;
  password: string;
}

/** `POST /api/auth/google` */
export interface GoogleLoginInput {
  /** ID token devolvido pelo Google Identity Services */
  idToken: string;
}

/** `PUT /api/auth/me` */
export interface UserUpdateInput {
  name: string;
}

/** `PUT /api/auth/me/password` — `currentPassword` obrigatório quando a conta já tem senha. */
export interface PasswordUpdateInput {
  currentPassword?: string | null;
  newPassword: string;
}

/** Sessão guardada em `localStorage` (`pontua:auth`, Princípio VI). */
export interface AuthSession {
  token: string;
  expiresAt: string;
  user: UserInfo;
}
