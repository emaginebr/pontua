using Pontua.Domain.Models;

namespace Pontua.Domain.Interfaces;

/// <summary>Emissão do JWT da API (R-02).</summary>
public interface ITokenService
{
    (string Token, DateTime ExpiresAt) Generate(User user);
}
