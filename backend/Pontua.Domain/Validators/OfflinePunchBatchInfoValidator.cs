using System.Globalization;
using System.Text.RegularExpressions;
using FluentValidation;
using Pontua.DTO.Punches;

namespace Pontua.Domain.Validators;

/// <summary>Lote offline (R-10): 1–50 itens, <c>clientId</c> uuid não vazio e distinto, <c>punchedAt</c> ISO-8601 com offset.</summary>
public class OfflinePunchBatchInfoValidator : AbstractValidator<OfflinePunchBatchInfo>
{
    // Data e hora ISO-8601 terminando obrigatoriamente em "Z" ou "±hh:mm".
    private static readonly Regex _isoWithOffset = new(
        @"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,7})?)?(Z|[+-]\d{2}:\d{2})$",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    public OfflinePunchBatchInfoValidator()
    {
        RuleFor(x => x.Items)
            .NotNull().WithMessage($"Informe de 1 a {OfflinePunchBatchInfo.MAX_ITEMS} marcações.")
            .Must(items => items!.Count is >= 1 and <= OfflinePunchBatchInfo.MAX_ITEMS)
            .WithMessage($"Informe de 1 a {OfflinePunchBatchInfo.MAX_ITEMS} marcações.")
            .When(x => x.Items != null, ApplyConditionTo.CurrentValidator);

        RuleFor(x => x.Items)
            .Must(HaveDistinctClientIds).WithMessage("Há marcações repetidas no lote (mesmo clientId).")
            .When(x => x.Items != null);

        RuleForEach(x => x.Items).ChildRules(item =>
        {
            item.RuleFor(i => i.ClientId)
                .NotEmpty().WithMessage("O identificador da marcação (clientId) é obrigatório.")
                .Must(id => TryParseClientId(id, out _)).WithMessage("O clientId deve ser um uuid válido.")
                .When(i => !string.IsNullOrWhiteSpace(i.ClientId), ApplyConditionTo.CurrentValidator);

            item.RuleFor(i => i.PunchedAt)
                .NotEmpty().WithMessage("O horário da marcação (punchedAt) é obrigatório.")
                .Must(value => TryParsePunchedAt(value, out _))
                .WithMessage("O horário deve estar no formato ISO-8601 com fuso (ex.: 2026-11-25T08:02:41-03:00).")
                .When(i => !string.IsNullOrWhiteSpace(i.PunchedAt), ApplyConditionTo.CurrentValidator);
        }).When(x => x.Items != null);
    }

    public static bool TryParseClientId(string? value, out Guid clientId)
    {
        clientId = Guid.Empty;
        return !string.IsNullOrWhiteSpace(value)
               && Guid.TryParse(value.Trim(), out clientId)
               && clientId != Guid.Empty;
    }

    /// <summary>Lê o instante do aparelho; exige offset explícito (<c>Z</c> ou <c>±hh:mm</c>).</summary>
    public static bool TryParsePunchedAt(string? value, out DateTimeOffset punchedAt)
    {
        punchedAt = default;
        if (string.IsNullOrWhiteSpace(value))
            return false;
        var trimmed = value.Trim();
        return _isoWithOffset.IsMatch(trimmed)
               && DateTimeOffset.TryParse(trimmed, CultureInfo.InvariantCulture, DateTimeStyles.None, out punchedAt);
    }

    private static bool HaveDistinctClientIds(List<OfflinePunchItem>? items)
    {
        var ids = items!
            .Select(i => TryParseClientId(i.ClientId, out var id) ? id : (Guid?)null)
            .Where(id => id.HasValue)
            .ToList();
        return ids.Distinct().Count() == ids.Count;
    }
}
