using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PetGest.Api.Data.Entities;

namespace PetGest.Api.Data.Configurations;

// Nomes de tabela, PK e checks iguais aos que o Postgres gerou para o schema.sql do
// V0 (design D1), para a T-18 só registrar a migration V0Schema em produção.
public class PetshopConfiguration : IEntityTypeConfiguration<Petshop>
{
    public void Configure(EntityTypeBuilder<Petshop> builder)
    {
        builder.ToTable("petshops", t =>
        {
            t.HasCheckConstraint("petshops_name_check", "length(btrim(name)) > 0");
            t.HasCheckConstraint("petshops_email_check", "length(btrim(email)) > 0");
        });

        builder.HasKey(p => p.Id).HasName("petshops_pkey");
        builder.Property(p => p.Id).HasDefaultValueSql("gen_random_uuid()");
        builder.Property(p => p.Name).HasColumnType("text");
        builder.Property(p => p.Email).HasColumnType("text");
        builder.Property(p => p.Phone).HasColumnType("text");
        builder.Property(p => p.CreatedAt).HasDefaultValueSql("now()").ValueGeneratedOnAdd();
    }
}
