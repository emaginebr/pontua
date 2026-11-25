using System.Text.Json.Serialization;

namespace Pontua.DTO.Companies;

/// <summary>Empresa na lista do usuário (<c>GET /api/companies</c>) e resultado do aceite de convite.</summary>
public class CompanySummary
{
    [JsonPropertyName("companyId")]
    public long CompanyId { get; set; }

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("isOwner")]
    public bool IsOwner { get; set; }

    [JsonPropertyName("isManager")]
    public bool IsManager { get; set; }

    [JsonPropertyName("memberId")]
    public long MemberId { get; set; }

    /// <summary>Cargo vigente hoje (nulo se o membro ainda não tiver cargo vigente).</summary>
    [JsonPropertyName("positionName")]
    public string? PositionName { get; set; }
}
