using System.Text.Json.Serialization;

namespace Pontua.DTO.Companies;

/// <summary>Acesso do usuário chamador na empresa (R-03).</summary>
public class MyAccessInfo
{
    [JsonPropertyName("memberId")]
    public long MemberId { get; set; }

    [JsonPropertyName("isOwner")]
    public bool IsOwner { get; set; }

    [JsonPropertyName("isManager")]
    public bool IsManager { get; set; }

    [JsonPropertyName("managedPositionIds")]
    public List<long> ManagedPositionIds { get; set; } = new();
}
