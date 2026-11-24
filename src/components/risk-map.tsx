'use client';

import 'leaflet/dist/leaflet.css';
import { useState } from 'react';
import { CircleMarker, MapContainer, TileLayer, Tooltip } from 'react-leaflet';

export interface MapPoint { id: string; borrower: string; lat: number; lon: number; ead: number; score: number; haz: Record<string, number>; geo: string }
export interface MapRegion { name: string; lat: number; lon: number; hazard: Record<string, number> }

const color = (v: number) => (v >= 0.7 ? '#dc2626' : v >= 0.5 ? '#f97316' : v >= 0.3 ? '#eab308' : '#16a34a');
const LAYERS = ['composite', 'flood', 'drought', 'heat', 'coastal'] as const;

export default function RiskMap({ points, regions }: { points: MapPoint[]; regions: MapRegion[] }) {
  const [layer, setLayer] = useState<(typeof LAYERS)[number]>('composite');
  const maxEad = Math.max(...points.map((p) => p.ead));
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        {LAYERS.map((l) => (
          <button key={l} onClick={() => setLayer(l)} className={`rounded-md px-2.5 py-1 text-xs capitalize ring-1 ${layer === l ? 'bg-zinc-900 text-white ring-zinc-900' : 'text-zinc-700 ring-zinc-300'}`}>
            {l === 'composite' ? 'Collateral risk (composite)' : `${l} hazard`}
          </button>
        ))}
      </div>
      <MapContainer center={[7.9, -1.1]} zoom={7} scrollWheelZoom={false} style={{ height: 560, borderRadius: 8 }}>
        <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {layer !== 'composite' && regions.map((r) => (
          <CircleMarker key={r.name} center={[r.lat, r.lon]} radius={38} pathOptions={{ color: color(r.hazard[layer]), fillColor: color(r.hazard[layer]), fillOpacity: 0.28, weight: 1 }}>
            <Tooltip>{r.name}: {layer} hazard {(1 + 4 * r.hazard[layer]).toFixed(1)} / 5</Tooltip>
          </CircleMarker>
        ))}
        {points.map((p) => {
          const v = layer === 'composite' ? p.score : p.haz[layer];
          return (
            <CircleMarker key={p.id} center={[p.lat, p.lon]} radius={3 + 9 * Math.sqrt(p.ead / maxEad)} pathOptions={{ color: color(v), fillColor: color(v), fillOpacity: 0.75, weight: p.geo === 'gps' ? 1 : 2, dashArray: p.geo === 'gps' ? undefined : '3' }}>
              <Tooltip>
                <b>{p.borrower}</b> · {p.id}<br />
                GHS {(p.ead / 1e6).toFixed(1)}m · score {(1 + 4 * v).toFixed(1)} / 5 · location {p.geo}
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-zinc-600">
        {[['Low', 0.1], ['Moderate', 0.35], ['High', 0.55], ['Very high', 0.8]].map(([l, v]) => (
          <span key={l as string} className="flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color(v as number) }} />{l}</span>
        ))}
        <span>Dashed outline = located by address/region (lower confidence) · size = exposure</span>
      </div>
    </div>
  );
}
