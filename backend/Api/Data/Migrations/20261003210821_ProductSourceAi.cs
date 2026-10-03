using System.Text.Json;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PetGest.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class ProductSourceAi : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "products_source_check",
                table: "products");

            migrationBuilder.AddColumn<JsonDocument>(
                name: "ai_raw_response",
                table: "products",
                type: "jsonb",
                nullable: true);

            migrationBuilder.AddCheckConstraint(
                name: "products_ai_raw_response_check",
                table: "products",
                sql: "ai_raw_response is null or source in ('photo_ai', 'voice_ai')");

            migrationBuilder.AddCheckConstraint(
                name: "products_source_check",
                table: "products",
                sql: "source in ('barcode', 'manual', 'photo_ai', 'voice_ai')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "products_ai_raw_response_check",
                table: "products");

            migrationBuilder.DropCheckConstraint(
                name: "products_source_check",
                table: "products");

            migrationBuilder.DropColumn(
                name: "ai_raw_response",
                table: "products");

            migrationBuilder.AddCheckConstraint(
                name: "products_source_check",
                table: "products",
                sql: "source in ('barcode', 'manual')");
        }
    }
}
