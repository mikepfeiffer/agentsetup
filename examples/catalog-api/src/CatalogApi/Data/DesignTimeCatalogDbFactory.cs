using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace CatalogApi.Data;

/// <summary>
/// Lets <c>dotnet ef migrations add</c> build a <see cref="CatalogDb"/> without
/// running the app's startup (migrate + seed) code. Design-time only.
/// </summary>
public class DesignTimeCatalogDbFactory : IDesignTimeDbContextFactory<CatalogDb>
{
    public CatalogDb CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<CatalogDb>()
            .UseSqlite("Data Source=catalog.db")
            .Options;
        return new CatalogDb(options);
    }
}
