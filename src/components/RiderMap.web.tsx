// Store location + delivery pins for the rider dashboard — same Mapbox
// setup pattern as RadiusMapEditor.web.tsx/OrderHeatmap.web.tsx. Draws a
// dashed straight-line from the store to each pin (this is a distance
// estimate, not a real route) so the rider can eyeball which delivery is
// closest before claiming.
import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { radii } from '../constants/theme';

if (process.env.EXPO_PUBLIC_MAPBOX_TOKEN) {
  mapboxgl.accessToken = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
}

export interface RiderMapPin {
  id: string;
  lat: number;
  long: number;
  claimed: boolean;
}

interface Props {
  storeLat: number;
  storeLong: number;
  pins: RiderMapPin[];
  selectedId?: string | null;
}

const LINES_SOURCE_ID = 'rider-delivery-lines';

export default function RiderMap({ storeLat, storeLong, pins, selectedId }: Props) {
  const containerRef = useRef<View | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const storeMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const pinMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());

  // Create the map once.
  useEffect(() => {
    const node = containerRef.current as unknown as HTMLElement | null;
    if (!node) return;

    const map = new mapboxgl.Map({
      container: node,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [storeLong, storeLat],
      zoom: 12,
    });
    mapRef.current = map;

    map.on('load', () => {
      map.addSource(LINES_SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: `${LINES_SOURCE_ID}-layer`,
        type: 'line',
        source: LINES_SOURCE_ID,
        paint: { 'line-color': '#595959', 'line-width': 2, 'line-dasharray': [2, 2] },
      });
      storeMarkerRef.current = new mapboxgl.Marker({ color: '#1A1A1A' }).setLngLat([storeLong, storeLat]).addTo(map);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      storeMarkerRef.current = null;
      pinMarkersRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeLat, storeLong]);

  // Keep pins + lines in sync without rebuilding the whole map.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const sync = () => {
      const seen = new Set<string>();
      pins.forEach((pin) => {
        seen.add(pin.id);
        let marker = pinMarkersRef.current.get(pin.id);
        if (!marker) {
          marker = new mapboxgl.Marker({ color: pin.claimed ? '#4D4D4D' : '#595959' })
            .setLngLat([pin.long, pin.lat])
            .addTo(map);
          pinMarkersRef.current.set(pin.id, marker);
        } else {
          marker.setLngLat([pin.long, pin.lat]);
        }
        marker.getElement().style.filter = pin.id === selectedId ? 'drop-shadow(0 0 4px #000)' : '';
      });
      pinMarkersRef.current.forEach((marker, id) => {
        if (!seen.has(id)) {
          marker.remove();
          pinMarkersRef.current.delete(id);
        }
      });

      const source = map.getSource(LINES_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
      if (source) {
        source.setData({
          type: 'FeatureCollection',
          features: pins.map((pin) => ({
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: [
                [storeLong, storeLat],
                [pin.long, pin.lat],
              ],
            },
          })),
        });
      }

      if (pins.length > 0) {
        const bounds = new mapboxgl.LngLatBounds([storeLong, storeLat], [storeLong, storeLat]);
        pins.forEach((pin) => bounds.extend([pin.long, pin.lat]));
        map.fitBounds(bounds, { padding: 60, duration: 300, maxZoom: 14 });
      }
    };

    if (map.isStyleLoaded()) sync();
    else map.once('load', sync);
  }, [pins, selectedId, storeLat, storeLong]);

  return (
    <View ref={containerRef} style={{ width: '100%', height: 320, borderRadius: radii.md, overflow: 'hidden' }} />
  );
}
