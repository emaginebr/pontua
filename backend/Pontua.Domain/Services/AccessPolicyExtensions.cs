using Pontua.Domain.Interfaces;
using Pontua.Domain.Models;

namespace Pontua.Domain.Services;

public static class AccessPolicyExtensions
{
    /// <summary>
    /// Permissão "👁 ou o próprio" (FR-028): o próprio membro sempre; outro membro exige
    /// <see cref="ICompanyAccessPolicy.RequireCanSuperviseAsync"/> na data (cargo vigente do alvo).
    /// </summary>
    public static async Task RequireSelfOrSuperviseAsync(
        this ICompanyAccessPolicy policy,
        AccessContext context,
        long targetMemberId,
        DateOnly date)
    {
        var ownMemberId = context.RequireMember();
        if (ownMemberId == targetMemberId)
            return;
        await policy.RequireCanSuperviseAsync(context, targetMemberId, date);
    }
}
