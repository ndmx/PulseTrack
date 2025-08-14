import React, { useEffect, useMemo, useRef, useState } from "react"
import { MapContainer, GeoJSON, useMap } from "react-leaflet"
import L, { LatLngBoundsExpression, PathOptions } from "leaflet"
import "leaflet/dist/leaflet.css"

type SnapLeafletMapProps = {
  geojsonUrl?: string
  height?: number
}

export const SnapLeafletMap: React.FC<SnapLeafletMapProps> = ({ geojsonUrl, height = 600 }) => {
  const [data, setData] = useState<any | null>(null)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [containerWidth, setContainerWidth] = useState<number>(0)

  useEffect(() => {
    const url = geojsonUrl || (import.meta as any).env.VITE_SNAPSTATS_GEOJSON_URL
    if (!url) { setError("Missing VITE_SNAPSTATS_GEOJSON_URL"); return }
    fetch(url).then(r => r.json()).then(json => setData(json)).catch(e => setError(String(e)))
  }, [geojsonUrl])

	const zoneColors: Record<string, string> = useMemo(() => ({
		"North Central": "#2E8B57",
		"North East": "#4169E1",
		"North West": "#DC143C",
		"South East": "#FF8C00",
		"South South": "#9932CC",
		"South West": "#FFD700",
	}), [])

	const style = (feature: any): PathOptions => {
		const zone = feature?.properties?.Zone
		return {
			fillColor: zoneColors[zone] || "#808080",
			color: "#333",
			weight: 1.5,
			fillOpacity: 0.7,
		}
	}

  const onEach = (feature: any, layer: L.Layer) => {
    const props = feature?.properties || {}
    const name = props.shapeName || props.State || "Unknown"
    const zone = props.Zone || "Unknown"
    ;(layer as L.Path).bindTooltip(`${name} — ${zone}`)
  }

  // Compute bounds (guarded)
  let bounds: LatLngBoundsExpression | undefined
  try {
    if (data) bounds = L.geoJSON(data).getBounds()
  } catch {
    // Fallback Nigeria bounds if parsing fails
    bounds = L.latLngBounds([4, 3], [14, 14])
  }

	const defaultCenter: [number, number] = [9.082, 8.6753] // [lat, lng]
	const defaultZoom = 6

  // Responsive height: derive from container width and viewport height
  useEffect(() => {
    const update = () => {
      const w = containerRef.current?.clientWidth || 0
      if (w > 0) setContainerWidth(prev => Math.abs(prev - w) > 2 ? w : prev)
    }
    update()
    const ro = (window as any).ResizeObserver ? new (window as any).ResizeObserver(update) : null
    if (ro && containerRef.current) ro.observe(containerRef.current)
    window.addEventListener('resize', update)
    const t = setInterval(update, 150)
    setTimeout(() => clearInterval(t), 1000)
    return () => {
      if (ro && containerRef.current) ro.unobserve(containerRef.current)
      window.removeEventListener('resize', update)
      clearInterval(t)
    }
  }, [])

  const mapHeight = useMemo(() => {
    const vwH = typeof window !== 'undefined' ? window.innerHeight : 800
    // cap height to 70vh, and scale with width for small screens
    const byVh = Math.round(vwH * 0.7)
    const byW = containerWidth ? Math.max(260, Math.round(containerWidth * 0.65)) : height
    return Math.min(byVh, byW, height)
  }, [containerWidth, height])

  // Helper to fit bounds on mount/resize
  const AutoFit: React.FC<{ w: number; h: number; b?: LatLngBoundsExpression }> = ({ w, h, b }) => {
    const map = useMap()
    useEffect(() => {
      try {
        map.invalidateSize(false)
        if (b) {
          map.fitBounds(b, { padding: [16, 16] as any, animate: false })
          map.setMaxBounds((b as L.LatLngBounds).pad(0.05))
        }
      } catch {
        /* no-op */
      }
    }, [map, w, h, b])
    return null
  }

  return (
    <div ref={containerRef} style={{ height: mapHeight, width: "100%", border: "1px solid #E9ECEF", borderRadius: 12, background: 'transparent' }}>
      <MapContainer
				style={{ height: "100%", width: "100%", background: 'transparent' }}
        maxBoundsViscosity={1.0}
        minZoom={0}
        maxZoom={18}
				zoomSnap={1 as any}
				zoomControl={false}
				doubleClickZoom={false}
				scrollWheelZoom={false}
				dragging={false}
				touchZoom={false as any}
				boxZoom={false as any}
				keyboard={false as any}
				attributionControl={false}
        center={defaultCenter}
        zoom={defaultZoom}
			>
        {/* No base TileLayer to keep background clean; add one with low opacity if desired */}
        {error ? null : (!data ? null : (
          <GeoJSON data={data as any} style={style as any} onEachFeature={onEach} />
        ))}
        <AutoFit w={containerWidth} h={mapHeight} b={bounds} />
			</MapContainer>
      {!error && (
        <div style={{ fontSize: 12, color: '#666', padding: 8 }}>
          {data ? `Loaded features: ${data?.features?.length || 0}` : 'Loading map...'}
        </div>
      )}
		</div>
	)
}

export default SnapLeafletMap


