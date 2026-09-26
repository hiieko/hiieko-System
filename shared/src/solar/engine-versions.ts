/**
 * Engine/schema version constants.
 *
 * Every SolarDesignVersion.snapshot embeds these values so historical
 * revisions remain reproducible and never silently change when a current
 * algorithm is upgraded. Bump the relevant value whenever a rule changes.
 */
export const SOLAR_SNAPSHOT_SCHEMA_VERSION = 1;

export interface SolarEngineVersions {
  geometry: string;
  layout: string;
  mounting: string;
  bom: string;
  engineering: string | null;
}

export const SOLAR_ENGINE_VERSIONS: SolarEngineVersions = {
  geometry: '1.0.0',
  layout: '1.0.0',
  mounting: '1.0.0',
  bom: '1.0.0',
  engineering: null,
};
