namespace Pontua.DTO.Settings;

public class DatabaseSettings
{
    /// <summary>
    /// Aplica as migrações pendentes do EF Core no startup da API. Só deve ser <c>true</c> no ambiente de
    /// homologação (<c>Docker</c>); em Development usa-se <c>dotnet ef database update</c> e em Production a
    /// estratégia de migração do cluster.
    /// </summary>
    public bool MigrateOnStartup { get; set; }
}
