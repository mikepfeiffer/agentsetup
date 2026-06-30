using CatalogApi.Data;
using CatalogApi.Models;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// Connection string comes from configuration. appsettings.json holds a
// non-secret default; real secrets belong in user-secrets / env vars, never in
// a committed appsettings.* file (the hook blocks appsettings.Production.json).
var connectionString =
    builder.Configuration.GetConnectionString("Catalog") ?? "Data Source=catalog.db";
builder.Services.AddDbContext<CatalogDb>(options => options.UseSqlite(connectionString));

var app = builder.Build();

// Apply EF Core migrations (generated code under Migrations/ — never hand-edited;
// add a new migration instead) and seed once.
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<CatalogDb>();
    db.Database.Migrate();
    CatalogSeed.EnsureSeeded(db);
}

app.MapGet("/products", async (CatalogDb db) =>
    Results.Ok(await db.Products.AsNoTracking().ToListAsync()));

app.MapGet("/products/{id:int}", async (int id, CatalogDb db) =>
    await db.Products.FindAsync(id) is { } product
        ? Results.Ok(product)
        : Results.Problem(
            statusCode: StatusCodes.Status404NotFound,
            title: "Product not found",
            detail: $"No product with id {id}."));

app.MapPost("/products", async (CreateProductRequest request, CatalogDb db) =>
{
    // Validate at the edge — never trust the caller.
    var errors = ProductValidation.Validate(request);
    if (errors.Count > 0)
        return Results.ValidationProblem(errors);

    var product = new Product { Name = request.Name!.Trim(), Price = request.Price };
    db.Products.Add(product);
    await db.SaveChangesAsync();
    return Results.Created($"/products/{product.Id}", product);
});

app.Run();

// Exposed so the test project's WebApplicationFactory<Program> can boot the app.
public partial class Program { }
