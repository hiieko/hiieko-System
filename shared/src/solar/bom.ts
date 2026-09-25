/**
 * Pure BOM derivation (PROTOTYPE).
 *
 * Engineering-required quantities only; rail length is reported in mm and
 * converted to metres at the presentation layer. A future cutting/purchasing
 * optimizer is a separate step (reserved `SolarBomPurchaseItem`).
 */
import { BomLine, ModulePlacement, ModuleSpecModel, MountingResult } from './types';

export function computeBom(
  placements: ModulePlacement[],
  moduleSpec: ModuleSpecModel,
  mounting: MountingResult,
): BomLine[] {
  const lines: BomLine[] = [];
  const moduleLabel = `${moduleSpec.manufacturer} ${moduleSpec.model}`.trim() || 'PV-MODULE';

  lines.push({
    itemType: 'MODULE',
    code: moduleLabel,
    name: moduleLabel,
    quantityRequired: placements.length,
    unit: 'buc',
  });

  if (mounting.railTotalLengthMm > 0) {
    lines.push({
      itemType: 'RAIL',
      code: 'DEMO-RAIL',
      name: 'Demo aluminium rail (PROTOTYPE)',
      quantityRequired: mounting.railTotalLengthMm,
      unit: 'mm',
    });
  }
  if (mounting.hookCount > 0) {
    lines.push({
      itemType: 'HOOK',
      code: 'DEMO-HOOK',
      name: 'Demo roof hook (PROTOTYPE)',
      quantityRequired: mounting.hookCount,
      unit: 'buc',
    });
  }
  if (mounting.endClampCount > 0) {
    lines.push({
      itemType: 'CLAMP',
      code: 'DEMO-END-CLAMP',
      name: 'Demo end clamp (PROTOTYPE)',
      quantityRequired: mounting.endClampCount,
      unit: 'buc',
    });
  }
  if (mounting.midClampCount > 0) {
    lines.push({
      itemType: 'CLAMP',
      code: 'DEMO-MID-CLAMP',
      name: 'Demo mid clamp (PROTOTYPE)',
      quantityRequired: mounting.midClampCount,
      unit: 'buc',
    });
  }
  if (mounting.fastenerCount > 0) {
    lines.push({
      itemType: 'FASTENER',
      code: 'DEMO-FASTENER',
      name: 'Demo fastener (PROTOTYPE)',
      quantityRequired: mounting.fastenerCount,
      unit: 'buc',
    });
  }
  if (mounting.epdmCount > 0) {
    lines.push({
      itemType: 'EPDM',
      code: 'DEMO-EPDM',
      name: 'Demo EPDM seal (PROTOTYPE)',
      quantityRequired: mounting.epdmCount,
      unit: 'buc',
    });
  }

  return lines;
}
