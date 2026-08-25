// Shows the delivery radius as a real circle over actual streets — same
// Mapbox setup pattern as LandmarkMapModal.web.tsx. Updates live as the
// admin edits the radius number next to it; no drag-to-resize (yet), this
// is purely "see what this number actually covers."
import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { circlePolygon } from '../lib/delivery';
import { radii } from '../constants/theme';

if (process.env.EXPO_PUBLIC_MAPBOX_TOKEN) {
  mapboxgl.accessToken = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
}

interface Props {
  lat: number;
  long: number;
  radiusKm: number;
}

const CIRCLE_SOURCE_ID = 'delivery-radius-circle';

export default function RadiusMapEditor({ lat, long, radiusKm }: Props) {
  const containerRef = useRef<View | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);

  // Create the map once.
  useEffect(() => {
    const node = containerRef.current as unknown as HTMLElement | null;
    if (!node) return;

    const map = new mapboxgl.Map({
      container: node,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [long, lat],
      zoom: 11,
    });
    mapRef.current = map;

    map.on('load', () => {
      map.addSource(CIRCLE_SOURCE_ID, {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'Polygon', coordinates: [circlePolygon(lat, long, radiusKm)] },
        },
      });
      map.addLayer({
        id: `${CIRCLE_SOURCE_ID}-fill`,
        type: 'fill',
        source: CIRCLE_SOURCE_ID,
        paint: { 'fill-color': '#DFA24E', 'fill-opacity': 0.18 },
      });
      map.addLayer({
        id: `${CIRCLE_SOURCE_ID}-line`,
        type: 'line',
        source: CIRCLE_SOURCE_ID,
        paint: { 'line-color': '#DFA24E', 'line-width': 2 },
      });
      markerRef.current = new mapboxgl.Marker({ color: '#3F6B4C' }).setLngLat([long, lat]).addTo(map);
      map.fitBounds(
        [
          [long - radiusKm / 80, lat - radiusKm / 111],
          [long + radiusKm / 80, lat + radiusKm / 111],
        ],
        { padding: 20, duration: 0 }
      );
    });

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // Only rebuild the whole map if the restaurant location itself moves —
    // radius changes are handled by updating the source below instead, so
    // the map doesn't reset/rezoom on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, long]);

  // Update just the circle geometry when the radius changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource(CIRCLE_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
    if (!source) return;
    source.setData({
      type: 'Feature',
      properties: {},
      geometry: { type: 'Polygon', coordinates: [circlePolygon(lat, long, radiusKm)] },
    });
  }, [lat, long, radiusKm]);

  return <View ref={containerRef} style={{ width: '100%', height: 260, borderRadius: radii.md, overflow: 'hidden' }} />;
}
