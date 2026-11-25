using System.Text.Json.Serialization;

namespace Pontua.DTO.Companies;

/// <summary>Dados da empresa com o responsável e o acesso do usuário chamador.</summary>
public class CompanyInfo
{
    [JsonPropertyName("companyId")]
    public long CompanyId { get; set; }

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("document")]
    public string? Document { get; set; }

    [JsonPropertyName("timeZone")]
    public string TimeZone { get; set; } = string.Empty;

    [JsonPropertyName("manualRetroDays")]
    public int ManualRetroDays { get; set; }

    [JsonPropertyName("owner")]
    public CompanyOwnerInfo Owner { get; set; } = new();

    [JsonPropertyName("myAccess")]
    public MyAccessInfo MyAccess { get; set; } = new();

    [JsonPropertyName("createdAt")]
    public DateTime CreatedAt { get; set; }
}

/// <summary>Responsável pela empresa.</summary>
public class CompanyOwnerInfo
{
    [JsonPropertyName("memberId")]
    public long MemberId { get; set; }

    [JsonPropertyName("userId")]
    public long UserId { get; set; }

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;
}
