using System.Text.Json.Serialization;

namespace Pontua.DTO.Companies;

/// <summary>Atualização dos dados da empresa (<c>PUT /api/companies/{companyId}</c>, só o responsável).</summary>
public class CompanyUpdateInfo
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("document")]
    public string? Document { get; set; }

    [JsonPropertyName("timeZone")]
    public string TimeZone { get; set; } = string.Empty;

    /// <summary>Limite retroativo das marcações manuais, em dias (1–365).</summary>
    [JsonPropertyName("manualRetroDays")]
    public int ManualRetroDays { get; set; }
}
