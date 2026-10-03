using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PetGest.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class V0Schema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "petshops",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    name = table.Column<string>(type: "text", nullable: false),
                    email = table.Column<string>(type: "text", nullable: false),
                    phone = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("petshops_pkey", x => x.id);
                    table.CheckConstraint("petshops_email_check", "length(btrim(email)) > 0");
                    table.CheckConstraint("petshops_name_check", "length(btrim(name)) > 0");
                });

            migrationBuilder.CreateTable(
                name: "products",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    petshop_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "text", nullable: false),
                    category = table.Column<string>(type: "text", nullable: false),
                    price = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
                    ean = table.Column<string>(type: "text", nullable: true),
                    source = table.Column<string>(type: "text", nullable: false, defaultValue: "manual"),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("products_pkey", x => x.id);
                    table.CheckConstraint("products_category_check", "length(btrim(category)) > 0");
                    table.CheckConstraint("products_ean_check", "ean is null or ean ~ '^[0-9]{8,14}$'");
                    table.CheckConstraint("products_name_check", "length(btrim(name)) > 0");
                    table.CheckConstraint("products_price_check", "price >= 0");
                    table.CheckConstraint("products_source_check", "source in ('barcode', 'manual')");
                    table.ForeignKey(
                        name: "products_petshop_id_fkey",
                        column: x => x.petshop_id,
                        principalTable: "petshops",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "profiles",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    petshop_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("profiles_pkey", x => x.id);
                    table.ForeignKey(
                        name: "profiles_petshop_id_fkey",
                        column: x => x.petshop_id,
                        principalTable: "petshops",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "products_petshop_ean_key",
                table: "products",
                columns: new[] { "petshop_id", "ean" },
                unique: true,
                filter: "ean IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "profiles_petshop_id_idx",
                table: "profiles",
                column: "petshop_id");

            // updated_at automático, idêntico ao schema.sql do V0 (design D3 da T-13).
            migrationBuilder.Sql("""
                create or replace function public.set_updated_at()
                returns trigger
                language plpgsql
                set search_path = ''
                as $$
                begin
                  new.updated_at := now();
                  return new;
                end;
                $$;

                create trigger products_set_updated_at
                  before update on public.products
                  for each row execute function public.set_updated_at();
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("drop function if exists public.set_updated_at() cascade;");

            migrationBuilder.DropTable(
                name: "products");

            migrationBuilder.DropTable(
                name: "profiles");

            migrationBuilder.DropTable(
                name: "petshops");
        }
    }
}
