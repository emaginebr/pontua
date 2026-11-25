using System.Security.Claims;
using Pontua.Domain.Exceptions;

namespace Pontua.API.Extensions;

public static class ClaimsPrincipalExtensions
{
    /// <summary>Id do usuário autenticado (claim <c>sub</c> do JWT); ausente ou inválido → 401.</summary>
    public static long GetUserId(this ClaimsPrincipal principal)
    {
        var value = principal.FindFirstValue("sub") ?? principal.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(value) || !long.TryParse(value, out var userId))
            throw new UnauthorizedException();
        return userId;
    }
}
