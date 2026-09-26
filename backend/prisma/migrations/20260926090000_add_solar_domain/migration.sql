-- CreateEnum
CREATE TYPE "SolarDesignStatusEnum" AS ENUM ('DRAFT', 'IN_PROGRESS', 'REVIEW', 'APPROVED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "SolarModuleOrientationEnum" AS ENUM ('PORTRAIT', 'LANDSCAPE');

-- CreateEnum
CREATE TYPE "SolarRoofTypeEnum" AS ENUM ('FLAT', 'PITCHED', 'GABLE', 'HIP', 'COMPLEX');

-- CreateEnum
CREATE TYPE "SolarProductTypeEnum" AS ENUM ('RAIL', 'ROOF_HOOK', 'END_CLAMP', 'MID_CLAMP', 'RAIL_CONNECTOR', 'FASTENER', 'BRACKET', 'TILE_HOOK', 'TRAPEZOID_ATTACHMENT', 'STANDING_SEAM_CLAMP', 'BALLAST', 'EPDM', 'OTHER');

-- CreateEnum
CREATE TYPE "SolarCatalogStatusEnum" AS ENUM ('DEMO', 'DRAFT', 'VALIDATED');

-- CreateEnum
CREATE TYPE "SolarBomItemTypeEnum" AS ENUM ('MODULE', 'RAIL', 'HOOK', 'CLAMP', 'CONNECTOR', 'FASTENER', 'EPDM', 'CUSTOM');

-- CreateTable
CREATE TABLE "solar_designs" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "SolarDesignStatusEnum" NOT NULL DEFAULT 'DRAFT',
    "current_version_id" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "solar_designs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solar_design_versions" (
    "id" TEXT NOT NULL,
    "design_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "label" TEXT,
    "status" "SolarDesignStatusEnum" NOT NULL DEFAULT 'DRAFT',
    "snapshot" JSONB NOT NULL,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "solar_design_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solar_roof_sections" (
    "id" TEXT NOT NULL,
    "design_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "roof_type" "SolarRoofTypeEnum" NOT NULL DEFAULT 'FLAT',
    "slope_deg" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "azimuth_deg" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "roof_material" TEXT,
    "polygon" JSONB NOT NULL,
    "origin" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "solar_roof_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solar_obstacles" (
    "id" TEXT NOT NULL,
    "roof_section_id" TEXT NOT NULL,
    "name" TEXT,
    "obstacle_type" TEXT,
    "polygon" JSONB NOT NULL,
    "keepout_margin_mm" DECIMAL(10,3) NOT NULL DEFAULT 0,

    CONSTRAINT "solar_obstacles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solar_module_specs" (
    "id" TEXT NOT NULL,
    "manufacturer" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "power_wp" DECIMAL(10,3),
    "length_mm" DECIMAL(10,3) NOT NULL,
    "width_mm" DECIMAL(10,3) NOT NULL,
    "thickness_mm" DECIMAL(10,3),
    "weight_kg" DECIMAL(10,3),
    "voc" DECIMAL(10,4),
    "isc" DECIMAL(10,4),
    "vmp" DECIMAL(10,4),
    "imp" DECIMAL(10,4),
    "technology" TEXT,
    "module_type" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "solar_module_specs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solar_layout_settings" (
    "id" TEXT NOT NULL,
    "design_id" TEXT NOT NULL,
    "module_spec_id" TEXT,
    "orientation" "SolarModuleOrientationEnum" NOT NULL DEFAULT 'PORTRAIT',
    "edge_margin_mm" DECIMAL(10,3) NOT NULL DEFAULT 300,
    "row_spacing_mm" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "column_spacing_mm" DECIMAL(10,3) NOT NULL DEFAULT 20,

    CONSTRAINT "solar_layout_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solar_module_placements" (
    "id" TEXT NOT NULL,
    "design_id" TEXT NOT NULL,
    "roof_section_id" TEXT NOT NULL,
    "module_spec_id" TEXT,
    "row" INTEGER NOT NULL,
    "column" INTEGER NOT NULL,
    "local_x" DECIMAL(12,4) NOT NULL,
    "local_y" DECIMAL(12,4) NOT NULL,
    "local_z" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "rotation_deg" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "width_mm" DECIMAL(10,3) NOT NULL,
    "height_mm" DECIMAL(10,3) NOT NULL,

    CONSTRAINT "solar_module_placements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solar_mounting_families" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "solar_mounting_families_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solar_products" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "family_id" TEXT,
    "product_type" "SolarProductTypeEnum" NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'buc',
    "length_mm" DECIMAL(10,3),
    "width_mm" DECIMAL(10,3),
    "height_mm" DECIMAL(10,3),
    "weight_kg" DECIMAL(10,3),
    "alloy" TEXT,
    "cross_section" JSONB,
    "structural_properties" JSONB,
    "cad_ref" TEXT,
    "catalog_status" "SolarCatalogStatusEnum" NOT NULL DEFAULT 'DEMO',
    "material_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "solar_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solar_product_compatibilities" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "compatible_product_id" TEXT NOT NULL,
    "rule_type" TEXT,
    "notes" TEXT,

    CONSTRAINT "solar_product_compatibilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solar_bom_snapshots" (
    "id" TEXT NOT NULL,
    "design_version_id" TEXT NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total_weight_kg" DECIMAL(12,3),
    "notes" TEXT,

    CONSTRAINT "solar_bom_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solar_bom_items" (
    "id" TEXT NOT NULL,
    "bom_snapshot_id" TEXT NOT NULL,
    "product_id" TEXT,
    "item_type" "SolarBomItemTypeEnum" NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity_required" DECIMAL(14,3) NOT NULL,
    "unit" TEXT NOT NULL,
    "cut_length_mm" DECIMAL(10,3),
    "notes" TEXT,

    CONSTRAINT "solar_bom_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "solar_designs_project_id_idx" ON "solar_designs"("project_id");

-- CreateIndex
CREATE INDEX "solar_designs_status_idx" ON "solar_designs"("status");

-- CreateIndex
CREATE UNIQUE INDEX "solar_designs_project_id_name_key" ON "solar_designs"("project_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "solar_design_versions_design_id_version_key" ON "solar_design_versions"("design_id", "version");

-- CreateIndex
CREATE INDEX "solar_roof_sections_design_id_idx" ON "solar_roof_sections"("design_id");

-- CreateIndex
CREATE INDEX "solar_obstacles_roof_section_id_idx" ON "solar_obstacles"("roof_section_id");

-- CreateIndex
CREATE UNIQUE INDEX "solar_module_specs_manufacturer_model_key" ON "solar_module_specs"("manufacturer", "model");

-- CreateIndex
CREATE UNIQUE INDEX "solar_layout_settings_design_id_key" ON "solar_layout_settings"("design_id");

-- CreateIndex
CREATE INDEX "solar_module_placements_design_id_idx" ON "solar_module_placements"("design_id");

-- CreateIndex
CREATE INDEX "solar_module_placements_roof_section_id_idx" ON "solar_module_placements"("roof_section_id");

-- CreateIndex
CREATE UNIQUE INDEX "solar_mounting_families_code_key" ON "solar_mounting_families"("code");

-- CreateIndex
CREATE UNIQUE INDEX "solar_products_code_key" ON "solar_products"("code");

-- CreateIndex
CREATE INDEX "solar_products_family_id_idx" ON "solar_products"("family_id");

-- CreateIndex
CREATE INDEX "solar_products_product_type_idx" ON "solar_products"("product_type");

-- CreateIndex
CREATE INDEX "solar_products_material_id_idx" ON "solar_products"("material_id");

-- CreateIndex
CREATE INDEX "solar_products_catalog_status_idx" ON "solar_products"("catalog_status");

-- CreateIndex
CREATE UNIQUE INDEX "solar_product_compatibilities_product_id_compatible_product_key" ON "solar_product_compatibilities"("product_id", "compatible_product_id");

-- CreateIndex
CREATE UNIQUE INDEX "solar_bom_snapshots_design_version_id_key" ON "solar_bom_snapshots"("design_version_id");

-- CreateIndex
CREATE INDEX "solar_bom_items_bom_snapshot_id_idx" ON "solar_bom_items"("bom_snapshot_id");

-- AddForeignKey
ALTER TABLE "solar_designs" ADD CONSTRAINT "solar_designs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solar_designs" ADD CONSTRAINT "solar_designs_current_version_id_fkey" FOREIGN KEY ("current_version_id") REFERENCES "solar_design_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solar_design_versions" ADD CONSTRAINT "solar_design_versions_design_id_fkey" FOREIGN KEY ("design_id") REFERENCES "solar_designs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solar_roof_sections" ADD CONSTRAINT "solar_roof_sections_design_id_fkey" FOREIGN KEY ("design_id") REFERENCES "solar_designs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solar_obstacles" ADD CONSTRAINT "solar_obstacles_roof_section_id_fkey" FOREIGN KEY ("roof_section_id") REFERENCES "solar_roof_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solar_layout_settings" ADD CONSTRAINT "solar_layout_settings_design_id_fkey" FOREIGN KEY ("design_id") REFERENCES "solar_designs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solar_layout_settings" ADD CONSTRAINT "solar_layout_settings_module_spec_id_fkey" FOREIGN KEY ("module_spec_id") REFERENCES "solar_module_specs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solar_module_placements" ADD CONSTRAINT "solar_module_placements_design_id_fkey" FOREIGN KEY ("design_id") REFERENCES "solar_designs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solar_module_placements" ADD CONSTRAINT "solar_module_placements_roof_section_id_fkey" FOREIGN KEY ("roof_section_id") REFERENCES "solar_roof_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solar_module_placements" ADD CONSTRAINT "solar_module_placements_module_spec_id_fkey" FOREIGN KEY ("module_spec_id") REFERENCES "solar_module_specs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solar_products" ADD CONSTRAINT "solar_products_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "solar_mounting_families"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solar_products" ADD CONSTRAINT "solar_products_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solar_product_compatibilities" ADD CONSTRAINT "solar_product_compatibilities_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "solar_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solar_product_compatibilities" ADD CONSTRAINT "solar_product_compatibilities_compatible_product_id_fkey" FOREIGN KEY ("compatible_product_id") REFERENCES "solar_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solar_bom_snapshots" ADD CONSTRAINT "solar_bom_snapshots_design_version_id_fkey" FOREIGN KEY ("design_version_id") REFERENCES "solar_design_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solar_bom_items" ADD CONSTRAINT "solar_bom_items_bom_snapshot_id_fkey" FOREIGN KEY ("bom_snapshot_id") REFERENCES "solar_bom_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solar_bom_items" ADD CONSTRAINT "solar_bom_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "solar_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

