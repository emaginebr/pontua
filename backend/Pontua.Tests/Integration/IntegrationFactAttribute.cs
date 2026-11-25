namespace Pontua.Tests.Integration;

/// <summary>
/// <c>[Fact]</c> que só roda contra um PostgreSQL real informado em <c>PONTUA_TEST_DB</c> (connection string Npgsql).
/// Sem a variável, o teste é reportado como ignorado (skipped), sem falhar.
/// </summary>
public sealed class IntegrationFactAttribute : FactAttribute
{
    public const string CONNECTION_STRING_VARIABLE = "PONTUA_TEST_DB";

    public IntegrationFactAttribute()
    {
        if (string.IsNullOrWhiteSpace(ConnectionString))
            Skip = $"Defina {CONNECTION_STRING_VARIABLE} com a connection string de um PostgreSQL de teste para rodar este teste.";
    }

    public static string? ConnectionString => Environment.GetEnvironmentVariable(CONNECTION_STRING_VARIABLE);
}
