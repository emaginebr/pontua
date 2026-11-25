namespace Pontua.Domain.Interfaces;

/// <summary>Conversões entre UTC e o fuso da empresa (ID IANA, R-06).</summary>
public interface ICompanyClock
{
    /// <summary>Converte um instante UTC para o horário local da empresa.</summary>
    DateTime ToLocal(DateTime utc, string timeZoneId);

    /// <summary>Monta o instante UTC de uma data e hora locais da empresa.</summary>
    DateTime ToUtc(DateOnly date, TimeOnly time, string timeZoneId);

    /// <summary>Data local (dia de trabalho) de um instante UTC.</summary>
    DateOnly LocalDate(DateTime utc, string timeZoneId);

    /// <summary>Hoje no fuso da empresa.</summary>
    DateOnly TodayLocal(string timeZoneId);

    /// <summary>Início (inclusivo) e fim (exclusivo), em UTC, das datas locais do intervalo.</summary>
    (DateTime FromUtc, DateTime ToUtc) UtcBounds(DateOnly start, DateOnly end, string timeZoneId);
}
