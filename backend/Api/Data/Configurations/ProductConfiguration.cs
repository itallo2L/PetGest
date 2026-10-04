using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PetGest.Api.Data.Entities;

namespace PetGest.Api.Data.Configurations;

// Espelho de `products` do schema.sql do V0 (design D1). updated_at é reescrito pelo
// trigger products_set_updated_at, criado na migration V0Schema (design D3).
public class ProductConfiguration : IEntityTypeConfiguration<Product>
{
    public void Configure(EntityTypeBuilder<Product> builder)
    {
        builder.ToTable("products", t =>
        {
            t.HasCheckConstraint("products_name_check", "length(btrim(name)) > 0");
            t.HasCheckConstraint("products_category_check", "length(btrim(category)) > 0");
            t.HasCheckConstraint("products_price_check", "price >= 0");
            t.HasCheckConstraint("products_ean_check", "ean is null or ean ~ '^[0-9]{8,14}$'");
            t.HasCheckConstraint("products_source_check", "source in ('barcode', 'manual', 'photo_ai', 'voice_ai')");
            t.HasCheckConstraint(
                "products_ai_raw_response_check",
                "ai_raw_response is null or source in ('photo_ai', 'voice_ai')");
        });

        builder.HasKey(p => p.Id).HasName("products_pkey");
        builder.Property(p => p.Id).HasDefaultValueSql("gen_random_uuid()");
        builder.Property(p => p.Name).HasColumnType("text");
        builder.Property(p => p.Category).HasColumnType("text");
        // Token de concorrência: UPDATE/DELETE saem com "WHERE id = .. AND petshop_id = ..",
        // então um produto anexado à mão dizendo ser do petshop atual não alcança a
        // linha de outro petshop (design D5 da T-13). Não muda o schema.
        builder.Property(p => p.PetshopId).IsConcurrencyToken();
        builder.Property(p => p.Price).HasPrecision(10, 2);
        builder.Property(p => p.Ean).HasColumnType("text");
        builder.Property(p => p.Source)
            .HasColumnType("text")
            .HasConversion(s => s.ToWire(), s => ProductSourceExtensions.FromWire(s))
            .HasDefaultValue(ProductSource.Manual);
        builder.Property(p => p.AiRawResponse).HasColumnType("jsonb");
        builder.Property(p => p.CreatedAt).HasDefaultValueSql("now()").ValueGeneratedOnAdd();
        builder.Property(p => p.UpdatedAt).HasDefaultValueSql("now()").ValueGeneratedOnAddOrUpdate();

        builder.HasOne<Petshop>()
            .WithMany()
            .HasForeignKey(p => p.PetshopId)
            .HasConstraintName("products_petshop_id_fkey")
            .OnDelete(DeleteBehavior.Cascade);

        // Mesmo EAN pode existir em petshops diferentes, nunca duas vezes no mesmo.
        builder.HasIndex(p => new { p.PetshopId, p.Ean })
            .IsUnique()
            .HasFilter("ean IS NOT NULL")
            .HasDatabaseName("products_petshop_ean_key");
    }
}
