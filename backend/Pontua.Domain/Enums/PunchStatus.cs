namespace Pontua.Domain.Enums;

public enum PunchStatus
{
    Valid = 1,
    Pending = 2,
    Approved = 3,
    Rejected = 4,
    Cancelled = 5,

    /// <summary>Marcação original substituída por uma correção aprovada (R-11). Fora das horas, mas consultável.</summary>
    Superseded = 6
}

public static class PunchStatusExtensions
{
    /// <summary>Status que contam nas horas trabalhadas: <c>Valid</c> e <c>Approved</c> (R-09).</summary>
    public static bool CountsAsWorked(this PunchStatus status) =>
        status is PunchStatus.Valid or PunchStatus.Approved;

    /// <summary>
    /// Status efetivos, que aparecem no dia e recebem período (R-07). Só <c>Valid</c>/<c>Approved</c> ocupam os
    /// períodos; inclusões pendentes recebem um período hipotético e correções pendentes herdam o da original
    /// (ver <c>DayEvaluator</c>).
    /// </summary>
    public static bool IsEffective(this PunchStatus status) =>
        status is PunchStatus.Valid or PunchStatus.Approved or PunchStatus.Pending;
}
