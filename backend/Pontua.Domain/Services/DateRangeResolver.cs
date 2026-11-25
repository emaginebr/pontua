using System.Globalization;
using Pontua.Domain.Exceptions;
using Pontua.Domain.Models;
using Pontua.DTO.Common;

namespace Pontua.Domain.Services;

/// <summary>Resolve o filtro de datas das listagens (R-14, FR-026).</summary>
public static class DateRangeResolver
{
    public const int MAX_DAYS = 366;

    private const string MONTH_FORMAT = "yyyy-MM";
    private const string DATE_FORMAT = "yyyy-MM-dd";

    /// <param name="query">Parâmetros recebidos (pode ser nulo).</param>
    /// <param name="todayLocal">Hoje no fuso da empresa — usado quando nenhum parâmetro é informado.</param>
    public static DateRange Resolve(DateRangeQuery? query, DateOnly todayLocal)
    {
        var month = Normalize(query?.Month);
        var start = Normalize(query?.Start);
        var end = Normalize(query?.End);

        if (month != null && (start != null || end != null))
            throw new ValidationException("month", "Informe o mês ou o intervalo de datas, não os dois.");

        if (month != null)
        {
            if (!DateTime.TryParseExact(month, MONTH_FORMAT, CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsed))
                throw new ValidationException("month", "Mês inválido. Use o formato yyyy-MM.");
            return MonthOf(new DateOnly(parsed.Year, parsed.Month, 1));
        }

        if (start == null && end == null)
            return MonthOf(todayLocal);

        if (start == null)
            throw new ValidationException("start", "Informe a data inicial do intervalo.");
        if (end == null)
            throw new ValidationException("end", "Informe a data final do intervalo.");

        var startDate = ParseDate("start", start, "Data inicial inválida. Use o formato yyyy-MM-dd.");
        var endDate = ParseDate("end", end, "Data final inválida. Use o formato yyyy-MM-dd.");

        if (startDate > endDate)
            throw new ValidationException("start", "A data inicial deve ser anterior ou igual à data final.");

        var range = new DateRange(startDate, endDate);
        if (range.TotalDays > MAX_DAYS)
            throw new ValidationException("end", $"O intervalo pode ter no máximo {MAX_DAYS} dias.");

        return range;
    }

    public static DateRange MonthOf(DateOnly day)
    {
        var first = new DateOnly(day.Year, day.Month, 1);
        return new DateRange(first, first.AddMonths(1).AddDays(-1));
    }

    private static string? Normalize(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static DateOnly ParseDate(string field, string value, string message)
    {
        if (!DateOnly.TryParseExact(value, DATE_FORMAT, CultureInfo.InvariantCulture, DateTimeStyles.None, out var date))
            throw new ValidationException(field, message);
        return date;
    }
}
