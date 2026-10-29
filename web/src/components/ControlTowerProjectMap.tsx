'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Map as LeafletMap, Marker as LeafletMarker } from 'leaflet';
import { List, Map as MapIcon, Maximize2, MapPin } from 'lucide-react';
import { t, useLocale } from '@solar/shared';
import {
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_LABELS_EN,
  type ProjectStatus,
} from '../features/projects/types';
import { Button, Card } from './ui';

export interface ProjectMapSite {
  id: string;
  name: string;
  code: string;
  address?: string | null;
  latitude: number | null;
  longitude: number | null;
  status: string;
  targetEndDate: string | null;
  progressPercent: number | null;
}

type MapView = 'map' | 'list';

interface ControlTowerProjectMapProps {
  sites: ProjectMapSite[];
  selectedSiteId: string | null;
  onSelectSite: (siteId: string) => void;
  loading?: boolean;
  initialView?: MapView;
}

const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>';

function hasCoordinates(site: ProjectMapSite): boolean {
  return site.latitude !== null && site.longitude !== null
    && Number.isFinite(site.latitude) && Number.isFinite(site.longitude)
    && site.latitude >= -90 && site.latitude <= 90
    && site.longitude >= -180 && site.longitude <= 180;
}

function statusTone(status: string): string {
  switch (status) {
    case 'COMPLETED':
    case 'HANDOVER':
      return 'complete';
    case 'ON_HOLD':
    case 'CANCELLED':
      return 'paused';
    default:
      return 'active';
  }
}

function localizedStatus(status: string, locale: string): string {
  const labels = locale === 'en' ? PROJECT_STATUS_LABELS_EN : PROJECT_STATUS_LABELS;
  return labels[status as ProjectStatus] ?? status.replace(/_/g, ' ');
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function ControlTowerProjectMap({
  sites,
  selectedSiteId,
  onSelectSite,
  loading = false,
  initialView = 'map',
}: ControlTowerProjectMapProps) {
  const { locale } = useLocale();
  const [view, setView] = useState<MapView>(initialView);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [tilesUnavailable, setTilesUnavailable] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const leafletRef = useRef<typeof import('leaflet') | null>(null);
  const markersRef = useRef(new Map<string, LeafletMarker>());
  const onSelectRef = useRef(onSelectSite);
  const previousSelectionRef = useRef(selectedSiteId);
  const didInitialFitRef = useRef(false);
  onSelectRef.current = onSelectSite;

  const locatedSites = useMemo(() => sites.filter(hasCoordinates), [sites]);
  const unlocatedSites = useMemo(() => sites.filter((site) => !hasCoordinates(site)), [sites]);
  const hasLocations = locatedSites.length > 0;

  const fitAllSites = useCallback(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L || locatedSites.length === 0) return;

    const points = locatedSites.map((site) => [site.latitude!, site.longitude!] as [number, number]);
    const animate = !prefersReducedMotion();
    if (points.length === 1) {
      map.flyTo(points[0], 11, { animate, duration: animate ? 0.55 : 0 });
      return;
    }
    map.fitBounds(L.latLngBounds(points), {
      padding: [36, 36],
      maxZoom: 11,
      animate,
      duration: animate ? 0.55 : 0,
    });
  }, [locatedSites]);

  // Leaflet is loaded only in the browser. Project data is not included in tile
  // requests; the OSM provider sees only the geographic tile viewport.
  useEffect(() => {
    if (!hasLocations || !mapContainerRef.current || mapRef.current) return;
    let disposed = false;
    void import('leaflet').then((L) => {
      if (disposed || !mapContainerRef.current) return;
      leafletRef.current = L;
      const first = locatedSites[0];
      const map = L.map(mapContainerRef.current, {
        center: [first.latitude!, first.longitude!],
        zoom: 6,
        scrollWheelZoom: false,
        zoomControl: false,
        keyboard: true,
        preferCanvas: true,
      });
      const tileUrl = process.env.NEXT_PUBLIC_HIIEKO_MAP_TILES_URL?.trim() || OSM_TILE_URL;
      const attribution = process.env.NEXT_PUBLIC_HIIEKO_MAP_ATTRIBUTION?.trim() || OSM_ATTRIBUTION;
      const tiles = L.tileLayer(tileUrl, {
        attribution,
        maxZoom: 19,
        crossOrigin: true,
      });
      tiles.on('tileerror', () => setTilesUnavailable(true));
      tiles.on('tileload', () => setTilesUnavailable(false));
      tiles.addTo(map);
      L.control.zoom({ position: 'bottomright' }).addTo(map);
      mapRef.current = map;
      setMapError(false);
      setMapReady(true);
    }).catch(() => {
      if (!disposed) setMapError(true);
    });

    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
      leafletRef.current = null;
      markersRef.current.clear();
    };
    // The map instance is intentionally created once per available map surface.
    // Marker and viewport updates are handled separately below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasLocations]);

  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L || !mapReady) return;

    const currentIds = new Set(locatedSites.map((site) => site.id));
    for (const [siteId, marker] of markersRef.current) {
      if (!currentIds.has(siteId)) {
        marker.remove();
        markersRef.current.delete(siteId);
      }
    }

    for (const site of locatedSites) {
      let marker = markersRef.current.get(site.id);
      if (!marker) {
        marker = L.marker([site.latitude!, site.longitude!], {
          keyboard: true,
          title: `${site.name} (${site.code})`,
          alt: `${site.name}, ${site.code}, ${localizedStatus(site.status, locale)}`,
          riseOnHover: true,
          icon: L.divIcon({
            className: 'hii-project-map-icon',
            html: '<span class="hii-project-map-pin" aria-hidden="true"></span>',
            iconSize: [34, 40],
            iconAnchor: [17, 34],
          }),
        }).addTo(map);
        marker.on('click', () => onSelectRef.current(site.id));
        markersRef.current.set(site.id, marker);
      } else {
        marker.setLatLng([site.latitude!, site.longitude!]);
      }

      marker.setIcon(L.divIcon({
        className: 'hii-project-map-icon',
        html: `<span class="hii-project-map-pin hii-project-map-pin--${statusTone(site.status)}${site.id === selectedSiteId ? ' is-selected' : ''}" aria-hidden="true"></span>`,
        iconSize: [34, 40],
        iconAnchor: [17, 34],
      }));
      const markerElement = marker.getElement();
      if (markerElement) {
        markerElement.setAttribute('role', 'button');
        markerElement.setAttribute('aria-label', `${site.name}, ${site.code}, ${localizedStatus(site.status, locale)}`);
        markerElement.setAttribute('aria-pressed', String(site.id === selectedSiteId));
        markerElement.setAttribute('title', `${site.name} (${site.code})`);
      }
    }
  }, [locatedSites, locale, mapReady, selectedSiteId]);

  useEffect(() => {
    if (!mapReady || didInitialFitRef.current) return;
    didInitialFitRef.current = true;
    fitAllSites();
  }, [fitAllSites, mapReady]);

  useEffect(() => {
    const previous = previousSelectionRef.current;
    previousSelectionRef.current = selectedSiteId;
    const map = mapRef.current;
    if (!map || !mapReady || !selectedSiteId || previous === selectedSiteId) return;
    const site = locatedSites.find((item) => item.id === selectedSiteId);
    if (!site) return;
    const animate = !prefersReducedMotion();
    const currentZoom = typeof map.getZoom === 'function' ? map.getZoom() : 6;
    map.flyTo([site.latitude!, site.longitude!], Math.max(currentZoom, 11), {
      animate,
      duration: animate ? 0.65 : 0,
    });
  }, [locatedSites, mapReady, selectedSiteId]);

  useEffect(() => {
    if (view !== 'map' || !mapRef.current) return;
    mapRef.current.invalidateSize({ pan: false });
  }, [view]);

  return (
    <Card padding={false} className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5 sm:px-4">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-slate-900">{t('control_tower.site_map_title', locale)}</h2>
          <p className="text-[11px] text-slate-500">
            {loading ? t('control_tower.loading', locale) : t('control_tower.map_site_count', locale).replace('{count}', String(sites.length))}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => setView((current) => current === 'map' ? 'list' : 'map')}
            aria-pressed={view === 'map'}
            icon={view === 'map' ? <List className="size-4" /> : <MapIcon className="size-4" />}
          >
            {t(view === 'map' ? 'control_tower.map_list_view' : 'control_tower.map_map_view', locale)}
          </Button>
          {view === 'map' && hasLocations && (
            <Button type="button" size="sm" variant="secondary" onClick={fitAllSites} icon={<Maximize2 className="size-4" />}>
              {t('control_tower.map_fit_sites', locale)}
            </Button>
          )}
        </div>
      </div>

      <div className={view === 'map' ? 'block' : 'hidden'}>
        {loading && sites.length === 0 ? (
          <div className="flex h-[340px] items-center justify-center bg-slate-50 text-sm text-slate-500" role="status">
            {t('control_tower.loading', locale)}
          </div>
        ) : !hasLocations ? (
          <div className="flex h-[340px] flex-col items-center justify-center gap-2 bg-slate-50 px-6 text-center" role="status">
            <MapPin className="size-6 text-slate-400" aria-hidden="true" />
            <p className="text-sm font-semibold text-slate-700">{t('control_tower.map_no_coordinates', locale)}</p>
            <p className="text-xs text-slate-500">{t('control_tower.map_list_fallback', locale)}</p>
          </div>
        ) : mapError ? (
          <div className="flex h-[340px] flex-col items-center justify-center gap-2 bg-slate-50 px-6 text-center" role="alert">
            <p className="text-sm font-semibold text-slate-700">{t('control_tower.map_load_error', locale)}</p>
            <p className="text-xs text-slate-500">{t('control_tower.map_list_fallback', locale)}</p>
          </div>
        ) : (
          <div className="relative">
            <div ref={mapContainerRef} className="h-[340px] w-full bg-slate-100 sm:h-[420px]" aria-label={t('control_tower.site_map_title', locale)} />
            {tilesUnavailable && (
              <div className="absolute left-2 right-2 top-2 z-[500] rounded-md border border-warning/30 bg-white/95 px-3 py-2 text-xs text-warning-foreground shadow-sm" role="status">
                {t('control_tower.map_tiles_unavailable', locale)}
              </div>
            )}
          </div>
        )}
        {unlocatedSites.length > 0 && (
          <details className="border-t border-slate-100 px-3 py-2.5 sm:px-4">
            <summary className="cursor-pointer text-xs font-semibold text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hii-500">
              {t('control_tower.map_location_unavailable', locale)} ({unlocatedSites.length})
            </summary>
            <ul className="mt-2 divide-y divide-slate-100">
              {unlocatedSites.map((site) => (
                <li key={site.id}>
                  <button type="button" onClick={() => onSelectSite(site.id)} aria-pressed={site.id === selectedSiteId}
                    className={`flex min-h-10 w-full items-center justify-between gap-2 rounded-md px-2 text-left text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hii-500 ${site.id === selectedSiteId ? 'bg-hii-50 text-hii-800' : 'hover:bg-slate-50'}`}>
                    <span className="min-w-0 truncate font-medium">{site.code} · {site.name}</span>
                    <span className="shrink-0 text-slate-500">{t('control_tower.map_no_coordinates_short', locale)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      {view === 'list' && (
        <div className="divide-y divide-slate-100">
          {sites.map((site) => (
            <button key={site.id} type="button" onClick={() => onSelectSite(site.id)} aria-pressed={site.id === selectedSiteId}
              className={`flex min-h-14 w-full items-center gap-3 px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-hii-500 sm:px-4 ${site.id === selectedSiteId ? 'bg-hii-50' : 'hover:bg-slate-50'}`}>
              <MapPin className={`size-4 shrink-0 ${hasCoordinates(site) ? 'text-hii-600' : 'text-slate-400'}`} aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold text-slate-900">{site.name}</span>
                <span className="block truncate text-[11px] text-slate-500">{site.code} · {localizedStatus(site.status, locale)}</span>
              </span>
              {!hasCoordinates(site) && <span className="text-[10px] font-medium text-warning-foreground">{t('control_tower.map_no_coordinates_short', locale)}</span>}
              {hasCoordinates(site) && <span className="text-[11px] tabular-nums text-slate-500">{site.progressPercent === null ? '—' : `${site.progressPercent}%`}</span>}
            </button>
          ))}
          {sites.length === 0 && (
            <p className="px-4 py-8 text-center text-xs text-slate-500">
              {loading ? t('control_tower.loading', locale) : t('control_tower.map_no_sites', locale)}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
