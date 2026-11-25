using Pontua.Domain.Exceptions;

namespace Pontua.Domain.Models;

/// <summary>
/// Acesso do usuário a uma empresa, resolvido por requisição (R-03). Usuário sem vínculo ativo recebe 404
/// (não revela a existência da empresa); membro sem permissão recebe 403.
/// </summary>
public sealed class AccessContext
{
    public const string COMPANY_NOT_FOUND_MESSAGE = "Empresa não encontrada.";

    public long CompanyId { get; init; }
    public long UserId { get; init; }

    /// <summary>Membro do usuário na empresa (nulo se nunca foi membro).</summary>
    public long? MemberId { get; init; }

    /// <summary>Membro com vínculo ativo.</summary>
    public bool IsActive { get; init; }

    /// <summary>Responsável pela empresa.</summary>
    public bool IsOwner { get; init; }

    public bool IsManager { get; init; }

    /// <summary>Cargos supervisionados pelo gestor (vazio se não for gestor).</summary>
    public IReadOnlyCollection<long> ManagedPositionIds { get; init; } = Array.Empty<long>();

    /// <summary>Exige vínculo ativo; senão 404. Devolve o <c>MemberId</c>.</summary>
    public long RequireMember()
    {
        if (!IsActive || MemberId == null)
            throw new NotFoundException(COMPANY_NOT_FOUND_MESSAGE);
        return MemberId.Value;
    }

    /// <summary>Exige ser o responsável; sem vínculo → 404, membro comum ou gestor → 403.</summary>
    public long RequireOwner()
    {
        var memberId = RequireMember();
        if (!IsOwner)
            throw new ForbiddenException("Somente o responsável pela empresa pode realizar esta operação.");
        return memberId;
    }

    /// <summary>Responsável ou gestor de ao menos um cargo (acesso ao painel e às listagens de supervisão).</summary>
    public bool CanSuperviseAnyone => IsActive && (IsOwner || (IsManager && ManagedPositionIds.Count > 0));
}
