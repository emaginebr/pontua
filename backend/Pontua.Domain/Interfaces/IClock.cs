namespace Pontua.Domain.Interfaces;

/// <summary>Relógio do servidor (abstraído para testes).</summary>
public interface IClock
{
    /// <summary>Instante atual em UTC (<see cref="DateTimeKind.Utc"/>).</summary>
    DateTime UtcNow { get; }
}
