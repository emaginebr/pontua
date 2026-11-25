using Pontua.DTO.Companies;

namespace Pontua.Domain.Interfaces;

/// <summary>Empresas do usuário (FR-004 a FR-007).</summary>
public interface ICompanyService
{
    /// <summary>Empresas em que o usuário é membro ativo, por nome.</summary>
    Task<List<CompanySummary>> ListAsync(long userId);

    /// <summary>
    /// Cria a empresa com o usuário como responsável e membro ativo, já com o cargo inicial "Responsável" e a
    /// jornada semanal padrão (R-16a), numa única transação.
    /// </summary>
    Task<CompanyInfo> CreateAsync(long userId, CompanyInsertInfo info);

    /// <summary>Dados da empresa; sem vínculo ativo → 404.</summary>
    Task<CompanyInfo> GetAsync(long companyId, long userId);

    /// <summary>Atualiza os dados da empresa; só o responsável (403).</summary>
    Task<CompanyInfo> UpdateAsync(long companyId, long userId, CompanyUpdateInfo info);

    /// <summary>
    /// Transfere a responsabilidade (FR-006; só o responsável → 403). O alvo deve ser membro ativo (inexistente → 404;
    /// inativo → 422) e perde a designação de gestor; o antigo responsável continua membro comum. Uma transação.
    /// </summary>
    Task<CompanyInfo> TransferOwnershipAsync(long companyId, long userId, TransferOwnershipInfo info);
}
