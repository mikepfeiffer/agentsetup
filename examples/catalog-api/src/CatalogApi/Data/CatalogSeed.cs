using CatalogApi.Models;

namespace CatalogApi.Data;

public static class CatalogSeed
{
    /// <summary>Idempotently seeds a couple of products if the table is empty.</summary>
    public static void EnsureSeeded(CatalogDb db)
    {
        if (db.Products.Any()) return;

        db.Products.AddRange(
            new Product { Name = "Widget", Price = 9.99m },
            new Product { Name = "Gadget", Price = 19.95m });
        db.SaveChanges();
    }
}
