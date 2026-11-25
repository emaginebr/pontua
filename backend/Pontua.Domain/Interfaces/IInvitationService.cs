using Pontua.DTO.Common;
using Pontua.DTO.Companies;
using Pontua.DTO.Invitations;

namespace Pontua.Domain.Interfaces;

/// <summary>Convites reutilizáveis por link (FR-013, FR-014, R-13).</summary>
public interface IInvitationService
{
    /// <summary>
    /// Convites da empresa criados no intervalo (responsável), do mais recente para o mais antigo, opcionalmente
    /// filtrados pela situação (<c>active</c>, <c>expired</c>, <c>revoked</c>).
    /// </summary>
    Task<List<InvitationInfo>> ListAsync(long companyId, long userId, DateRangeQuery? query, string? status);

    /// <summary>Gera um convite para o cargo (responsável); validade padrão de 7 dias; cargo inexistente → 404.</summary>
    Task<InvitationInfo> CreateAsync(long companyId, long userId, InvitationInsertInfo info);

    /// <summary>Revoga o convite (responsável); já revogado → sem efeito.</summary>
    Task RevokeAsync(long companyId, long userId, long invitationId);

    /// <summary>Dados públicos do convite (nome da empresa, cargo, situação); token inexistente → 404.</summary>
    Task<InvitationPublicInfo> GetPublicAsync(string token);

    /// <summary>
    /// Aceita o convite: novo membro ou reativação com o cargo do convite. Membro ativo → 409; convite expirado ou
    /// revogado → 422; token inexistente → 404.
    /// </summary>
    Task<CompanySummary> AcceptAsync(string token, long userId);
}
