using System.Collections.Concurrent;
using Pontua.Domain.Exceptions;
using Pontua.Domain.Interfaces;

namespace Pontua.Domain.Services;

/// <summary>
/// Fuso horário da empresa (R-06). Instantes são gravados em UTC; datas e horários exibidos e filtrados estão
/// sempre no fuso da empresa (ID IANA, ex.: <c>America/Sao_Paulo</c>; no Windows o .NET 8 converte via ICU).
/// </summary>
public class CompanyClock : ICompanyClock
{
    private static readonly ConcurrentDictionary<string, TimeZoneInfo> _cache = new(StringComparer.Ordinal);

    private readonly IClock _clock;

    public CompanyClock(IClock clock)
    {
        _clock = clock;
    }

    public DateTime ToLocal(DateTime utc, string timeZoneId)
    {
        var instant = utc.Kind == DateTimeKind.Utc ? utc : DateTime.SpecifyKind(utc, DateTimeKind.Utc);
        return DateTime.SpecifyKind(TimeZoneInfo.ConvertTimeFromUtc(instant, FindTimeZone(timeZoneId)), DateTimeKind.Unspecified);
    }

    public DateTime ToUtc(DateOnly date, TimeOnly time, string timeZoneId)
    {
        var zone = FindTimeZone(timeZoneId);
        var local = date.ToDateTime(time, DateTimeKind.Unspecified);

        // Horário inexistente (início do horário de verão): avança até o primeiro horário válido.
        while (zone.IsInvalidTime(local))
            local = local.AddMinutes(30);

        return DateTime.SpecifyKind(TimeZoneInfo.ConvertTimeToUtc(local, zone), DateTimeKind.Utc);
    }

    public DateOnly LocalDate(DateTime utc, string timeZoneId) =>
        DateOnly.FromDateTime(ToLocal(utc, timeZoneId));

    public DateOnly TodayLocal(string timeZoneId) => LocalDate(_clock.UtcNow, timeZoneId);

    public (DateTime FromUtc, DateTime ToUtc) UtcBounds(DateOnly start, DateOnly end, string timeZoneId) =>
        (ToUtc(start, TimeOnly.MinValue, timeZoneId), ToUtc(end.AddDays(1), TimeOnly.MinValue, timeZoneId));

    /// <summary>Indica se o ID é um fuso IANA conhecido.</summary>
    public static bool IsValidTimeZone(string? timeZoneId)
    {
        if (string.IsNullOrWhiteSpace(timeZoneId) || timeZoneId.Trim() != timeZoneId)
            return false;
        if (!TimeZoneInfo.TryFindSystemTimeZoneById(timeZoneId, out var zone))
            return false;
        return zone.HasIanaId || TimeZoneInfo.TryConvertIanaIdToWindowsId(timeZoneId, out _);
    }

    /// <summary>Resolve o fuso; ID inválido → <see cref="ValidationException"/> no campo <c>timeZone</c>.</summary>
    public static TimeZoneInfo FindTimeZone(string timeZoneId)
    {
        if (_cache.TryGetValue(timeZoneId, out var cached))
            return cached;
        if (!IsValidTimeZone(timeZoneId))
            throw new ValidationException("timeZone", $"Fuso horário inválido: '{timeZoneId}'. Use um ID IANA, ex.: America/Sao_Paulo.");
        var zone = TimeZoneInfo.FindSystemTimeZoneById(timeZoneId);
        _cache[timeZoneId] = zone;
        return zone;
    }
}
