using Pontua.Domain.Enums;
using Pontua.Domain.Exceptions;

namespace Pontua.Domain.Models;

/// <summary>
/// Marcação de ponto — imutável (R-04, Portaria 671). Não há setters públicos: a criação é feita por
/// <see cref="Create"/> e a única mudança permitida é a de status, via <see cref="ChangeStatus"/>.
/// </summary>
public class Punch
{
    public const int JUSTIFICATION_MAX_LENGTH = 500;

    private Punch()
    {
    }

    public long PunchId { get; private set; }
    public long CompanyId { get; private set; }
    public long MemberId { get; private set; }

    /// <summary>Número sequencial do registro, único por empresa (R-05).</summary>
    public long Nsr { get; private set; }

    public PunchKind Kind { get; private set; }

    /// <summary>Instante da marcação (UTC).</summary>
    public DateTime PunchedAt { get; private set; }

    /// <summary>Dia local da marcação no fuso da empresa (R-06).</summary>
    public DateOnly WorkDate { get; private set; }

    /// <summary>Instante em que o servidor recebeu a marcação (UTC).</summary>
    public DateTime ReceivedAt { get; private set; }

    /// <summary>Única coluna alterável.</summary>
    public PunchStatus Status { get; private set; }

    public PendingReason? PendingReason { get; private set; }
    public string? Justification { get; private set; }
    public long? ReplacesPunchId { get; private set; }

    /// <summary>Identificador gerado pelo aparelho, só para marcações offline (idempotência, R-10).</summary>
    public Guid? ClientId { get; private set; }

    public long CreatedByUserId { get; private set; }

    public bool CountsAsWorked => Status.CountsAsWorked();

    public bool IsEffective => Status.IsEffective();

    public static Punch Create(
        long companyId,
        long memberId,
        long nsr,
        PunchKind kind,
        DateTime punchedAtUtc,
        DateOnly workDate,
        DateTime receivedAtUtc,
        PunchStatus status,
        PendingReason? pendingReason,
        long createdByUserId,
        string? justification = null,
        long? replacesPunchId = null,
        Guid? clientId = null)
    {
        if (status is not (PunchStatus.Valid or PunchStatus.Pending))
            throw new ArgumentException("Uma marcação nasce como válida ou pendente.", nameof(status));
        if (status == PunchStatus.Pending && pendingReason == null)
            throw new ArgumentException("Marcação pendente exige o motivo da pendência.", nameof(pendingReason));
        if (kind == PunchKind.Manual && string.IsNullOrWhiteSpace(justification))
            throw new ValidationException("justification", "A justificativa é obrigatória.");
        if (justification != null && justification.Trim().Length > JUSTIFICATION_MAX_LENGTH)
            throw new ValidationException("justification",
                $"A justificativa pode ter no máximo {JUSTIFICATION_MAX_LENGTH} caracteres.");
        if (kind == PunchKind.Offline && clientId == null)
            throw new ArgumentException("Marcação offline exige o identificador do aparelho.", nameof(clientId));
        if (replacesPunchId != null && kind != PunchKind.Manual)
            throw new ArgumentException("Só marcações manuais podem corrigir outra marcação.", nameof(replacesPunchId));

        return new Punch
        {
            CompanyId = companyId,
            MemberId = memberId,
            Nsr = nsr,
            Kind = kind,
            PunchedAt = DateTime.SpecifyKind(punchedAtUtc, DateTimeKind.Utc),
            WorkDate = workDate,
            ReceivedAt = DateTime.SpecifyKind(receivedAtUtc, DateTimeKind.Utc),
            Status = status,
            PendingReason = status == PunchStatus.Pending ? pendingReason : null,
            Justification = string.IsNullOrWhiteSpace(justification) ? null : justification.Trim(),
            ReplacesPunchId = replacesPunchId,
            ClientId = clientId,
            CreatedByUserId = createdByUserId
        };
    }

    /// <summary>
    /// Linha de histórico da criação (<c>from_status</c> nulo). O repositório preenche o <c>PunchId</c>
    /// depois de inserir a marcação.
    /// </summary>
    public PunchStatusChange CreationChange(DateTime utcNow, string? note = null) => new()
    {
        PunchId = PunchId,
        FromStatus = null,
        ToStatus = Status,
        ChangedByUserId = CreatedByUserId,
        Note = note,
        ChangedAt = utcNow
    };

    /// <summary>
    /// Única mudança permitida (R-04). Transições: <c>Pending → Approved | Rejected | Cancelled</c> e
    /// <c>Valid | Approved → Superseded</c>. Qualquer outra → <see cref="ConflictException"/> (409).
    /// </summary>
    /// <returns>A linha de histórico a gravar em <c>punch_status_changes</c>.</returns>
    public PunchStatusChange ChangeStatus(PunchStatus newStatus, long userId, string? note, DateTime utcNow)
    {
        if (!CanTransition(Status, newStatus))
        {
            throw newStatus == PunchStatus.Superseded
                ? new ConflictException("A marcação original já não está válida ou aprovada.")
                : new ConflictException("A marcação não está pendente.");
        }

        var change = new PunchStatusChange
        {
            PunchId = PunchId,
            FromStatus = Status,
            ToStatus = newStatus,
            ChangedByUserId = userId,
            Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim(),
            ChangedAt = utcNow
        };
        Status = newStatus;
        return change;
    }

    public static bool CanTransition(PunchStatus from, PunchStatus to) => (from, to) switch
    {
        (PunchStatus.Pending, PunchStatus.Approved) => true,
        (PunchStatus.Pending, PunchStatus.Rejected) => true,
        (PunchStatus.Pending, PunchStatus.Cancelled) => true,
        (PunchStatus.Valid, PunchStatus.Superseded) => true,
        (PunchStatus.Approved, PunchStatus.Superseded) => true,
        _ => false
    };
}
