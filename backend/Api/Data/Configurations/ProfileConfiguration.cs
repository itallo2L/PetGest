using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PetGest.Api.Data.Entities;

namespace PetGest.Api.Data.Configurations;

// `id` é o id da conta do Identity (mesmo Guid de auth.users no V0 — T-11 D4). A FK
// para identity.users fica na migration ProfilesUserFk, separada das tabelas do
// Identity para a T-18 importar as contas entre as duas (design D2 da T-14).
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

        builder.HasOne<AppUser>()
            .WithOne()
            .HasForeignKey<Profile>(p => p.Id)
            .HasConstraintName("profiles_id_fkey")
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(p => p.PetshopId).HasDatabaseName("profiles_petshop_id_idx");
    }
}
