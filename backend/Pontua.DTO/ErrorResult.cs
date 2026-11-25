using System.Text.Json.Serialization;

namespace Pontua.DTO;

/// <summary>Envelope de erro de toda resposta 4xx (contracts/api.md).</summary>
public class ErrorResult
{
    [JsonPropertyName("sucesso")]
    public bool Sucesso { get; set; }

    [JsonPropertyName("mensagem")]
    public string Mensagem { get; set; } = string.Empty;

    [JsonPropertyName("erros")]
    public List<ErrorItem> Erros { get; set; } = new();
}

public class ErrorItem
{
    [JsonPropertyName("campo")]
    public string Campo { get; set; } = string.Empty;

    [JsonPropertyName("mensagem")]
    public string Mensagem { get; set; } = string.Empty;
}
