/** Tipos comuns da API do Pontua (specs/001-pontua-backend-core/contracts/api.md). */

/**
 * Filtro de datas (`DateRange` do backend): `?month=yyyy-MM` **ou** `?start=yyyy-MM-dd&end=yyyy-MM-dd`
 * (inclusivos). Sem nenhum → mês corrente no fuso da empresa.
 */
export interface DateRangeQuery {
  /** Mês `yyyy-MM` */
  month?: string;
  /** Data inicial `yyyy-MM-dd` */
  start?: string;
  /** Data final `yyyy-MM-dd` */
  end?: string;
}

/** Erro de um campo no envelope de erro da API. */
export interface ApiFieldError {
  /** Nome do campo em camelCase (ex.: `email`, `justification`); vazio para erro geral */
  campo: string;
  mensagem: string;
}

/** Envelope de erro de toda resposta ≠ 2xx (a API não usa envelope em sucesso — research R-03). */
export interface ApiErrorBody {
  sucesso: false;
  mensagem: string;
  erros: ApiFieldError[];
}

/** Procedência de um dado lido com cache network-first (research R-07). */
export interface FreshnessInfo {
  /** `true` quando o dado veio do cache local por falta de conexão */
  stale: boolean;
  /** Quando o dado foi obtido do servidor (ISO) */
  fetchedAt: string;
}
