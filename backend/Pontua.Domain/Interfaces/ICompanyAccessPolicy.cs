using Pontua.Domain.Models;

namespace Pontua.Domain.Interfaces;

/// <summary>Política de acesso por empresa (R-03).</summary>
public interface ICompanyAccessPolicy
{
    /// <summary>Resolve o acesso do usuário na empresa. Nunca lança: sem vínculo → <c>IsActive = false</c>.</summary>
    Task<AccessContext> GetContextAsync(long companyId, long userId);

    /// <summary>Contexto de um membro ativo; sem vínculo ativo → 404.</summary>
    Task<AccessContext> RequireMemberAsync(long companyId, long userId);

    /// <summary>Contexto do responsável; sem vínculo → 404, sem ser responsável → 403.</summary>
    Task<AccessContext> RequireOwnerAsync(long companyId, long userId);

    /// <summary>
    /// Exige poder supervisionar o membro alvo na data: o responsável sempre; o gestor só se o cargo do alvo
    /// na data estiver entre os seus cargos. Alvo inexistente na empresa → 404; sem permissão → 403.
    /// </summary>
    Task RequireCanSuperviseAsync(AccessContext context, long targetMemberId, DateOnly date);

    /// <summary>Mesma regra de <see cref="RequireCanSuperviseAsync"/>, sem lançar 403.</summary>
    Task<bool> CanSuperviseAsync(AccessContext context, long targetMemberId, DateOnly date);
}
