using System.Text.Json.Serialization;

namespace Pontua.DTO.Companies;

/// <summary>Transferência de responsabilidade (FR-006): o membro alvo deve estar ativo.</summary>
public class TransferOwnershipInfo
{
    [JsonPropertyName("memberId")]
    public long? MemberId { get; set; }
}
