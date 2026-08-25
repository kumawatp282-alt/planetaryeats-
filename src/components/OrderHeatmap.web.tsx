// Plots every order that has a saved location (see StoreContext.placeOrder
// / logManualOrder) as a real Mapbox heatmap layer — same setup pattern as
// the other two Mapbox components in this app.
import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { radii } from '../constants/theme';

if (process.env.EXPO_PUBLIC_MAPBOX_TOKEN) {
  mapboxgl.accessToken = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
}

interface Props {
  points: { lat: number; long: number }[];
  centerLat: number;
  centerLong: number;
}

const SOURCE_ID = 'order-locations';

function toGeoJSON(points: { lat: number; long: number }[]): mapboxgl.GeoJSONSourceSpecification['data'] {
  return {
    type: 'FeatureCollection',
    features: points.map((p) => ({
      type: 'Feature',
      properties: {},
      geometry: { type: 'Point', coordinates: [p.long, p.lat] },
    })),
  };
}

export default function OrderHeatmap({ points, centerLat, centerLong }: Props) {
  const containerRef = useRef<View | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    const node = containerRef.current as unknown as HTMLElement | null;
    if (!node) return;

    const map = new mapboxgl.Map({
      container: node,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [centerLong, centerLat],
      zoom: 10.5,
    });
    mapRef.current = map;

    map.on('load', () => {
      map.addSource(SOURCE_ID, { type: 'geojson', data: toGeoJSON(points) });
      map.addLayer({
        id: `${SOURCE_ID}-heat`,
        type: 'heatmap',
        source: SOURCE_ID,
        paint: {
          'heatmap-weight': 1,
          'heatmap-intensity': 1,
          'heatmap-radius': 28,
          'heatmap-opacity': 0.85,
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0, 'rgba(0,0,0,0)',
            0.2, '#6B9C74',
            0.5, '#DFA24E',
            0.8, '#C1694A',
            1, '#B65540',
          ],
        },
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerLat, centerLong]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
    if (!source) return;
    source.setData(toGeoJSON(points));
  }, [points]);

  return <View ref={containerRef} style={{ width: '100%', height: 320, borderRadius: radii.md, overflow: 'hidden' }} />;
}
