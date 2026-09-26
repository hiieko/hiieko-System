-- CreateEnum
CREATE TYPE "SolarSurfaceTypeEnum" AS ENUM ('ROOF', 'GROUND', 'GRASS', 'GRAVEL', 'ROCK', 'ASPHALT', 'CONCRETE', 'PARKING', 'CARPORT', 'CUSTOM');

-- AlterTable
ALTER TABLE "solar_roof_sections" ADD COLUMN     "surface_type" "SolarSurfaceTypeEnum" NOT NULL DEFAULT 'ROOF',
ADD COLUMN     "thickness_mm" DECIMAL(10,3);

