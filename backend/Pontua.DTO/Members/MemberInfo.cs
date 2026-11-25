using System.Text.Json.Serialization;
using Pontua.DTO.Positions;
using Pontua.DTO.Schedules;

namespace Pontua.DTO.Members;

/// <summary>
/// Membro da empresa com cargo e jornada vigentes hoje. No detalhe (<c>GET .../members/{memberId}</c>) traz também
/// <see cref="PositionHistory"/> e <see cref="ScheduleHistory"/>.
/// </summary>
public class MemberInfo
{
    public const string STATUS_ACTIVE = "active";
    public const string STATUS_INACTIVE = "inactive";
    public const string STATUS_ALL = "all";

    [JsonPropertyName("memberId")]
    public long MemberId { get; set; }

    [JsonPropertyName("userId")]
    public long UserId { get; set; }

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("email")]
    public string Email { get; set; } = string.Empty;

    /// <summary><c>active</c> ou <c>inactive</c>.</summary>
    [JsonPropertyName("status")]
    public string Status { get; set; } = string.Empty;

    [JsonPropertyName("isOwner")]
    public bool IsOwner { get; set; }

    [JsonPropertyName("isManager")]
    public bool IsManager { get; set; }

    [JsonPropertyName("managedPositionIds")]
    public List<long> ManagedPositionIds { get; set; } = new();

    /// <summary>Cargo vigente hoje (nulo se não houver).</summary>
    [JsonPropertyName("position")]
    public PositionRef? Position { get; set; }

    /// <summary>A jornada vigente hoje é a própria do membro (não a do cargo).</summary>
    [JsonPropertyName("hasOwnSchedule")]
    public bool HasOwnSchedule { get; set; }

    [JsonPropertyName("joinedAt")]
    public DateTime JoinedAt { get; set; }

    /// <summary>Jornada vigente hoje (própria ou do cargo); nula se não houver.</summary>
    [JsonPropertyName("currentSchedule")]
    public ScheduleInfo? CurrentSchedule { get; set; }

    /// <summary>Vigências de cargo, da mais recente para a mais antiga — só no detalhe.</summary>
    [JsonPropertyName("positionHistory")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public List<MemberPositionInfo>? PositionHistory { get; set; }

    /// <summary>
    /// Versões de jornada própria do membro (FR-011), da mais recente para a mais antiga, incluindo as que voltam à
    /// jornada do cargo (<c>inheritsPosition: true</c>) — só no detalhe.
    /// </summary>
    [JsonPropertyName("scheduleHistory")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public List<ScheduleInfo>? ScheduleHistory { get; set; }
}
