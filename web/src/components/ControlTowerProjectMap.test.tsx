import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ControlTowerProjectMap, type ProjectMapSite } from './ControlTowerProjectMap';

jest.mock('@solar/shared', () => ({
  t: (key: string) => key,
  useLocale: () => ({ locale: 'en' }),
}));

jest.mock('./ui', () => {
  const ReactModule = jest.requireActual('react');
  return {
    Card: ({ children, className = '' }: React.HTMLAttributes<HTMLDivElement> & { padding?: boolean }) =>
      ReactModule.createElement('div', { className }, children),
    Button: ({ children, icon, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon?: React.ReactNode }) =>
      ReactModule.createElement('button', props, icon, children),
  };
});

jest.mock('leaflet', () => {
  const mapInstance = {
    fitBounds: jest.fn(),
    flyTo: jest.fn(),
    invalidateSize: jest.fn(),
    remove: jest.fn(),
  };
  const markers: Array<{ element: HTMLDivElement; handlers: Record<string, () => void> }> = [];
  const leaflet = {
    map: (container: HTMLElement) => {
      (mapInstance as typeof mapInstance & { container: HTMLElement }).container = container;
      return mapInstance;
    },
    tileLayer: () => ({ on: () => ({ on: () => ({ addTo: () => undefined }) }), addTo: () => undefined }),
    control: { zoom: () => ({ addTo: () => undefined }) },
    divIcon: (options: unknown) => ({ options }),
    latLngBounds: (points: unknown) => ({ points }),
    marker: (_coordinates: unknown, options: { icon: { options: { html: string } } }) => {
      const marker = {
        element: document.createElement('div'),
        handlers: {} as Record<string, () => void>,
        addTo: (map: { container: HTMLElement }) => {
          marker.element.innerHTML = options.icon.options.html;
          marker.element.tabIndex = 0;
          map.container.appendChild(marker.element);
          markers.push(marker);
          return marker;
        },
        on: (event: string, callback: () => void) => {
          marker.handlers[event] = callback;
          marker.element.addEventListener(event, callback);
          return marker;
        },
        setIcon: (icon: { options: { html: string } }) => {
          marker.element.innerHTML = icon.options.html;
        },
        setLatLng: () => marker,
        getElement: () => marker.element,
        remove: () => marker.element.remove(),
      };
      return marker;
    },
    __test: { markers, mapInstance },
  };
  return { __esModule: true, ...leaflet, default: leaflet };
});

const sites: ProjectMapSite[] = [
  {
    id: 'site-1', name: 'North site', code: 'NS-01', latitude: 45.75, longitude: 21.23,
    status: 'CONSTRUCTION', targetEndDate: null, progressPercent: 42,
  },
  {
    id: 'site-2', name: 'South site', code: 'SS-02', latitude: 44.4, longitude: 26.1,
    status: 'ON_HOLD', targetEndDate: null, progressPercent: null,
  },
  {
    id: 'site-no-coordinates', name: 'No location site', code: 'NL-03', latitude: null, longitude: null,
    status: 'PLANNING', targetEndDate: null, progressPercent: null,
  },
];

function SelectableMap() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  return (
    <ControlTowerProjectMap
      sites={sites}
      selectedSiteId={selectedId}
      onSelectSite={setSelectedId}
      initialView="map"
    />
  );
}

describe('ControlTowerProjectMap', () => {
  it('renders a keyboard-accessible marker for each project with stored coordinates', async () => {
    render(<SelectableMap />);

    const northMarker = await screen.findByRole('button', { name: 'North site, NS-01, Construction' });
    const southMarker = screen.getByRole('button', { name: 'South site, SS-02, On Hold' });
    expect(northMarker).toHaveAttribute('tabindex', '0');
    expect(southMarker).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('button', { name: /No location site/ })).toBeInTheDocument();

    fireEvent.click(northMarker);
    await waitFor(() => expect(northMarker).toHaveAttribute('aria-pressed', 'true'));
  });

  it('shows missing-coordinate sites in the list fallback and selection invokes the site callback', async () => {
    const user = userEvent.setup();
    const onSelectSite = jest.fn();
    render(
      <ControlTowerProjectMap
        sites={sites}
        selectedSiteId={null}
        onSelectSite={onSelectSite}
        initialView="list"
      />,
    );

    const listView = screen.getByText('No location site').closest('button');
    expect(listView).toHaveTextContent('control_tower.map_no_coordinates_short');
    await user.click(listView!);
    expect(onSelectSite).toHaveBeenCalledWith('site-no-coordinates');
  });

  it('shows a clear no-coordinate message and keeps the list toggle available', async () => {
    const user = userEvent.setup();
    render(
      <ControlTowerProjectMap
        sites={[sites[2]]}
        selectedSiteId={null}
        onSelectSite={jest.fn()}
      />,
    );

    expect(screen.getByText('control_tower.map_no_coordinates')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'control_tower.map_list_view' }));
    expect(screen.getByText('No location site')).toBeInTheDocument();
  });
});
