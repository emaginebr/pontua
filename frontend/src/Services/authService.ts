import type {
  AuthResult,
  GoogleLoginInput,
  LoginInput,
  PasswordUpdateInput,
  RegisterInput,
  UserInfo,
  UserUpdateInput,
} from "../types/auth";
import { apiFetch } from "./apiClient";

const API_BASE = "/api/auth";

/**
 * Conta e sessão (API › Auth). Padrão de classe da skill `react-architecture`; o tratamento
 * da resposta (`handleResponse` da skill) fica centralizado no `apiClient` (research R-03).
 */
class AuthService {
  /** Cria a conta e já devolve a sessão (`201 AuthResult`; 409 e-mail em uso). */
  async register(data: RegisterInput): Promise<AuthResult> {
    return apiFetch<AuthResult>(`${API_BASE}/register`, {
      method: "POST",
      body: data,
      authenticated: false,
      allowOffline: true,
    });
  }

  /** Entra com e-mail e senha (401 "E-mail ou senha inválidos."). */
  async login(data: LoginInput): Promise<AuthResult> {
    return apiFetch<AuthResult>(`${API_BASE}/login`, {
      method: "POST",
      body: data,
      authenticated: false,
      allowOffline: true,
    });
  }

  /** Entra (ou cria a conta) com o ID token do Google. */
  async loginWithGoogle(data: GoogleLoginInput): Promise<AuthResult> {
    return apiFetch<AuthResult>(`${API_BASE}/google`, {
      method: "POST",
      body: data,
      authenticated: false,
      allowOffline: true,
    });
  }

  /** Dados da conta do usuário logado. */
  async me(): Promise<UserInfo> {
    return apiFetch<UserInfo>(`${API_BASE}/me`);
  }

  /** Atualiza o nome. */
  async updateName(data: UserUpdateInput): Promise<UserInfo> {
    return apiFetch<UserInfo>(`${API_BASE}/me`, { method: "PUT", body: data });
  }

  /** Troca ou define a senha (204). */
  async updatePassword(data: PasswordUpdateInput): Promise<void> {
    await apiFetch<void>(`${API_BASE}/me/password`, { method: "PUT", body: data });
  }
}

export const authService = new AuthService();
export default AuthService;
