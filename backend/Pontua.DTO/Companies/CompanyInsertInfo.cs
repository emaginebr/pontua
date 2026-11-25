using System.Text.Json.Serialization;

namespace Pontua.DTO.Companies;

/// <summary>Criação de empresa (<c>POST /api/companies</c>). Fuso padrão: <c>America/Sao_Paulo</c>.</summary>
public class CompanyInsertInfo
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    /// <summary>CNPJ/CPF, só dígitos (opcional).</summary>
    [JsonPropertyName("document")]
    public string? Document { get; set; }

    /// <summary>ID IANA do fuso (opcional).</summary>
    [JsonPropertyName("timeZone")]
    public string? TimeZone { get; set; }
}
