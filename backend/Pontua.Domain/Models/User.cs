namespace Pontua.Domain.Models;

public class User
{
    public long UserId { get; set; }
    public string Name { get; set; } = string.Empty;

    /// <summary>Sempre armazenado em minúsculas (ver <see cref="NormalizeEmail"/>).</summary>
    public string Email { get; set; } = string.Empty;

    /// <summary>Nulo quando a conta só usa o login Google. Nunca sai em DTOs.</summary>
    public string? PasswordHash { get; set; }

    public string? GoogleSubject { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public bool HasPassword => !string.IsNullOrEmpty(PasswordHash);

    public bool HasGoogle => !string.IsNullOrEmpty(GoogleSubject);

    public static string NormalizeEmail(string? email) =>
        (email ?? string.Empty).Trim().ToLowerInvariant();
}
