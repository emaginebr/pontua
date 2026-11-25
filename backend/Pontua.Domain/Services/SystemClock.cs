using Pontua.Domain.Interfaces;

namespace Pontua.Domain.Services;

public class SystemClock : IClock
{
    public DateTime UtcNow => DateTime.UtcNow;
}
