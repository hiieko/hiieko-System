/**
 * Solar mapping helpers — convert Prisma rows to the shared `@solar/shared`
 * domain model and orchestrate the pure layout/mounting/BOM engines.
 *
 * Canonical units: millimetres, kilograms, degrees (see shared/src/solar/units.ts).
 */
import {
  SolarLayoutSettings,
  SolarModulePlacement,
  SolarModuleSpec,
  SolarObstacle,
  SolarRoofSection,
} from '@prisma/client';
import {
  BomLine,
  computeBom,
  computeLayout,
  computeMounting,
  LayoutSettingsModel,
  ModulePlacement,
  ModuleSpecModel,
  MountingResult,
  ObstacleModel,
  Point2D,
  Point3D,
  RoofSectionModel,
  SolarDesignModel,
} from '@solar/shared';
import { PrismaService } from '../../common/prisma/prisma.service';

const toNum = (v: unknown): number => {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'object' && typeof (v as { toNumber?: unknown }).toNumber === 'function') {
    return (v as { toNumber: () => number }).toNumber();
  }
  return Number(v);
};

export function polygonFromJson(json: unknown): Point2D[] {
  if (!Array.isArray(json)) return [];
  return json.map((p) => ({
    x: Number((p as { x: number }).x),
    y: Number((p as { y: number }).y),
  }));
}

export function originFromJson(json: unknown): Point3D {
  const o = json as { x: number; y: number; z: number } | null;
  if (!o) return { x: 0, y: 0, z: 0 };
  return { x: Number(o.x), y: Number(o.y), z: Number(o.z) };
}

export function toRoofSectionModel(s: SolarRoofSection): RoofSectionModel {
  return {
    id: s.id,
    designId: s.design_id,
    name: s.name,
    roofType: s.roof_type as RoofSectionModel['roofType'],
    surfaceType: (s.surface_type as RoofSectionModel['surfaceType']) ?? 'ROOF',
    slopeDeg: toNum(s.slope_deg),
    azimuthDeg: toNum(s.azimuth_deg),
    roofMaterial: s.roof_material ?? undefined,
    thicknessMm: s.thickness_mm == null ? undefined : toNum(s.thickness_mm),
    polygon: polygonFromJson(s.polygon),
    origin: originFromJson(s.origin),
  };
}

export function toObstacleModel(o: SolarObstacle): ObstacleModel {
  return {
    id: o.id,
    roofSectionId: o.roof_section_id,
    name: o.name ?? undefined,
    obstacleType: o.obstacle_type ?? undefined,
    polygon: polygonFromJson(o.polygon),
    keepoutMarginMm: toNum(o.keepout_margin_mm),
  };
}

export function toModuleSpecModel(m: SolarModuleSpec): ModuleSpecModel {
  return {
    id: m.id,
    manufacturer: m.manufacturer,
    model: m.model,
    powerWp: m.power_wp == null ? undefined : toNum(m.power_wp),
    lengthMm: toNum(m.length_mm),
    widthMm: toNum(m.width_mm),
    thicknessMm: m.thickness_mm == null ? undefined : toNum(m.thickness_mm),
    weightKg: m.weight_kg == null ? undefined : toNum(m.weight_kg),
    voc: m.voc == null ? undefined : toNum(m.voc),
    isc: m.isc == null ? undefined : toNum(m.isc),
    vmp: m.vmp == null ? undefined : toNum(m.vmp),
    imp: m.imp == null ? undefined : toNum(m.imp),
    technology: m.technology ?? undefined,
    moduleType: m.module_type ?? undefined,
  };
}

export function toLayoutSettingsModel(s: SolarLayoutSettings): LayoutSettingsModel {
  return {
    moduleSpecId: s.module_spec_id ?? undefined,
    orientation: s.orientation as LayoutSettingsModel['orientation'],
    edgeMarginMm: toNum(s.edge_margin_mm),
    rowSpacingMm: toNum(s.row_spacing_mm),
    columnSpacingMm: toNum(s.column_spacing_mm),
  };
}

export function toPlacement(p: SolarModulePlacement): ModulePlacement {
  return {
    id: p.id,
    roofSectionId: p.roof_section_id,
    moduleSpecId: p.module_spec_id ?? undefined,
    row: p.row,
    column: p.column,
    localX: toNum(p.local_x),
    localY: toNum(p.local_y),
    localZ: toNum(p.local_z),
    rotationDeg: toNum(p.rotation_deg),
    widthMm: toNum(p.width_mm),
    heightMm: toNum(p.height_mm),
  };
}

export async function loadDesignModel(
  prisma: PrismaService,
  designId: string,
): Promise<SolarDesignModel | null> {
  const design = await prisma.solarDesign.findUnique({
    where: { id: designId },
    include: {
      roof_sections: { include: { obstacles: true } },
      layout_settings: true,
      module_placements: true,
    },
  });

  if (!design) return null;

  const roofSections = design.roof_sections.map(toRoofSectionModel);
  const obstacles = design.roof_sections.flatMap((s) => s.obstacles.map(toObstacleModel));

  return {
    id: design.id,
    projectId: design.project_id,
    name: design.name,
    status: design.status,
    roofSections,
    obstacles,
    layoutSettings: design.layout_settings
      ? toLayoutSettingsModel(design.layout_settings)
      : undefined,
    placements: design.module_placements.map(toPlacement),
  };
}

export interface SolarCalcResult {
  placements: ModulePlacement[];
  mounting: MountingResult;
  bom: BomLine[];
  totalModules: number;
  totalPowerWp: number;
}

export const DEFAULT_LAYOUT_SETTINGS: LayoutSettingsModel = {
  orientation: 'PORTRAIT',
  edgeMarginMm: 300,
  rowSpacingMm: 0,
  columnSpacingMm: 20,
};

/** Run the pure layout + mounting + BOM engines over a design model. */
export function runEngines(model: SolarDesignModel, moduleSpec: ModuleSpecModel): SolarCalcResult {
  const settings = model.layoutSettings ?? DEFAULT_LAYOUT_SETTINGS;

  const placements: ModulePlacement[] = [];
  for (const roof of model.roofSections) {
    const roofObstacles = model.obstacles.filter((o) => o.roofSectionId === roof.id);
    placements.push(...computeLayout(roof, roofObstacles, moduleSpec, settings));
  }

  const mounting = computeMounting(placements);
  const bom = computeBom(placements, moduleSpec, mounting);

  return {
    placements,
    mounting,
    bom,
    totalModules: placements.length,
    totalPowerWp: placements.length * (moduleSpec.powerWp ?? 0),
  };
}
