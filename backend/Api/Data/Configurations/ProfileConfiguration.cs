using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PetGest.Api.Data.Entities;

namespace PetGest.Api.Data.Configurations;

// Sem FK de `id` para uma tabela de usuários: auth.users não existe fora do Supabase e
// as tabelas do Identity só chegam na T-14, que adiciona a FK (design D6).
public class ProfileConfiguration : IEntityTypeConfiguration<Profile>
{
    public void Configure(EntityTypeBuilder<Profile> builder)
    {
        builder.ToTable("profiles");

        builder.HasKey(p => p.Id).HasName("profiles_pkey");
        builder.Property(p => p.Id).ValueGeneratedNever();
        builder.Property(p => p.CreatedAt).HasDefaultValueSql("now()").ValueGeneratedOnAdd();

        builder.HasOne<Petshop>()
            .WithMany()
            .HasForeignKey(p => p.PetshopId)
            .HasConstraintName("profiles_petshop_id_fkey")
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(p => p.PetshopId).HasDatabaseName("profiles_petshop_id_idx");
    }
}
