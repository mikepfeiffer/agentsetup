using CatalogApi.Data;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace CatalogApi.Tests;

/// <summary>
/// Boots the real app but swaps the SQLite file DB for a private in-memory
/// connection, kept open for the fixture's lifetime. The app's startup
/// <c>Migrate()</c> + seed then build the schema against it — so tests exercise
/// the real migrations and endpoints without touching disk.
/// </summary>
public class CatalogApiFactory : WebApplicationFactory<Program>
{
    private readonly SqliteConnection _connection = new("DataSource=:memory:");

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        _connection.Open();
        builder.ConfigureServices(services =>
        {
            var descriptor = services.SingleOrDefault(
                d => d.ServiceType == typeof(DbContextOptions<CatalogDb>));
            if (descriptor is not null) services.Remove(descriptor);

            services.AddDbContext<CatalogDb>(options => options.UseSqlite(_connection));
        });
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (disposing) _connection.Dispose();
    }
}
