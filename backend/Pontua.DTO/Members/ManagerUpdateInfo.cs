using System.Text.Json.Serialization;

namespace Pontua.DTO.Members;

/// <summary>Designação de gestor (FR-022c): <c>isManager=false</c> remove a designação e limpa os cargos.</summary>
public class ManagerUpdateInfo
{
    [JsonPropertyName("isManager")]
    public bool? IsManager { get; set; }

    /// <summary>Cargos supervisionados (obrigatório, ao menos um, quando <see cref="IsManager"/> é verdadeiro).</summary>
    [JsonPropertyName("positionIds")]
    public List<long>? PositionIds { get; set; }
}
