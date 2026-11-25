namespace Pontua.Domain.Models;

/// <summary>Intervalo de datas locais da empresa, com início e fim inclusivos.</summary>
public sealed record DateRange(DateOnly Start, DateOnly End)
{
    public int TotalDays => End.DayNumber - Start.DayNumber + 1;

    public bool Contains(DateOnly date) => date >= Start && date <= End;

    public IEnumerable<DateOnly> Days()
    {
        for (var day = Start; day <= End; day = day.AddDays(1))
            yield return day;
    }
}
