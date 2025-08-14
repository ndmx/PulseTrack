import React, { useEffect, useMemo, useRef, useState } from "react"
import * as d3 from "d3"

export type Feature = {
  type: string
  properties: Record<string, any>
  geometry: { type: string; coordinates: any }
}

type SnapStatsMapProps = {
  features?: Feature[]
  height?: number
}

// Temporary simplified version: basic rendering with fixed fill to test GeoJSON shapes
export const SnapStatsMap: React.FC<SnapStatsMapProps> = ({ features: providedFeatures, height = 600 }) => {
  const ref = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [features, setFeatures] = useState<Feature[]>(providedFeatures || []);
  const [error, setError] = useState<string | null>(null);
  const [width, setWidth] = useState<number>(0);  // Start at 0 to force update
  const [tooltip, setTooltip] = useState<{ visible: boolean; x: number; y: number; html: string }>({ visible: false, x: 0, y: 0, html: '' })

  useEffect(() => {
    if (Array.isArray(providedFeatures)) {
      setFeatures(providedFeatures);
    }
  }, [providedFeatures]);

  // Load from URL if no provided features
  useEffect(() => {
    if (providedFeatures !== undefined) return;
    const url = import.meta.env.VITE_SNAPSTATS_GEOJSON_URL;
    if (!url) {
      setError("Missing VITE_SNAPSTATS_GEOJSON_URL");
      return;
    }
    fetch(url)
      .then((r) => r.json())
      .then((json) => {
        const feats = (json.features || []) as Feature[];
        console.log('Fetched features:', feats.length, 'sample:', feats[0]?.properties);
        setFeatures(feats);
      })
      .catch((e) => {
        console.error('Fetch error:', e);
        setError(String(e));
      });
  }, [providedFeatures]);

  // Update width on resize/mount
  useEffect(() => {
    const updateWidth = () => {
      const containerWidth = containerRef.current?.clientWidth;
      if (containerWidth && containerWidth > 0 && Math.abs(containerWidth - width) > 2) {
        setWidth(containerWidth);
      }
    };
    updateWidth();  // Initial set
    const interval = setInterval(updateWidth, 100);  // Poll if resize misses (e.g., tab change)
    window.addEventListener('resize', updateWidth);
    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', updateWidth);
    };
  }, [width]);

  const projection = useMemo(() => {
    const proj = d3.geoMercator();
    if (features && features.length > 0 && width > 0) {
      const collection: any = { type: 'FeatureCollection', features };
      try {
        // Use fitExtent for full fill without padding
        (proj as any).fitExtent([[0, 0], [width, height]], collection);
        const p = d3.geoPath(proj as any);
        const b = p.bounds(collection);
        const bw = b[1][0] - b[0][0];
        const bh = b[1][1] - b[0][1];
        if (!isFinite(bw) || !isFinite(bh) || bw < 10 || bh < 10) {
          throw new Error('Degenerate bounds');
        }
        console.log('Projection fitted (fitExtent):', { scale: (proj as any).scale?.(), translate: (proj as any).translate?.() });
      } catch (e) {
        console.warn('FitExtent failed, trying manual bounds:', e);
        (proj as any).scale?.(1);  // Reset
        const tempPath = d3.geoPath().projection(proj as any);
        try {
          const b = tempPath.bounds(collection);
          const bw = b[1][0] - b[0][0];
          const bh = b[1][1] - b[0][1];
          const s = Math.min(width / bw, height / bh);  // full fill
          const tx = (width - s * (b[1][0] + b[0][0])) / 2;
          const ty = (height - s * (b[1][1] + b[0][1])) / 2;
          (proj as any).scale?.(s).translate?.([tx, ty]);
          console.log('Projection fitted (manual):', { scale: (proj as any).scale?.(), translate: (proj as any).translate?.() });
        } catch (e2) {
          console.error('Manual fit failed, using Nigeria fallback:', e2);
          const fallbackScale = 1400 * (width / 800);
          (proj as any).scale?.(fallbackScale).center?.([8.6753, 9.082]).translate?.([width / 2, height / 2]);
        }
      }
    } else if (width > 0) {
      // Default if no features
      const fallbackScale = 1400 * (width / 800);
      (proj as any).scale?.(fallbackScale).center?.([8.6753, 9.082]).translate?.([width / 2, height / 2]);
    }
    return proj;
  }, [features, width, height]);

  const path = useMemo(() => d3.geoPath().projection(projection as any), [projection]);

  const zoneColors: Record<string, string> = useMemo(() => ({
    "North Central": "#2E8B57",
    "North East": "#4169E1",
    "North West": "#DC143C",
    "South East": "#FF8C00",
    "South South": "#9932CC",
    "South West": "#FFD700",
  }), [])

  if (error) return <p>Error: {error}</p>;
  if (!features.length) return <p>Loading map...</p>;

  return (
    <div ref={containerRef} style={{ position: 'relative', overflow: 'hidden', border: '1px solid #E9ECEF', borderRadius: 12, background: 'transparent', padding: 0 }}>
      <svg ref={ref} width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" style={{ background: 'transparent' }}>
        {features.map((f, i) => {
          const d = path(f as any);
          if (!d) return null;  // Skip invalid paths
          const props = f.properties || {}
          const zone = props.Zone
          return (
            <path
              key={i}
              d={d}
              fill={zoneColors[zone] || '#D0D0D0'}
              fillOpacity={0.85}
              stroke="#333"
              strokeWidth={0.8}
              vectorEffect="non-scaling-stroke"
              onMouseEnter={(e) => {
                const html = `<strong>${props.shapeName || 'Unknown'}</strong><br/>Zone: ${props.Zone || 'Unknown'}<br/>Parties: ${props.Typical_Parties || 'N/A'}<br/>Tribes: ${props.Major_Tribes || 'N/A'}<br/>Area: ${props.area_km2 || 'N/A'} km²`
                setTooltip({ visible: true, x: e.clientX, y: e.clientY, html })
              }}
              onMouseMove={(e) => {
                if (!tooltip.visible) return
                setTooltip(t => ({ ...t, x: e.clientX, y: e.clientY }))
              }}
              onMouseLeave={() => setTooltip({ visible: false, x: 0, y: 0, html: '' })}
            />
          );
        })}
      </svg>
      {tooltip.visible && (
        <div
          style={{
            position: 'fixed',
            left: tooltip.x + 12,
            top: tooltip.y + 12,
            background: '#fff',
            color: '#212529',
            border: '1px solid #E9ECEF',
            borderRadius: 8,
            padding: '8px 10px',
            fontSize: 12,
            boxShadow: '0 6px 18px rgba(0,0,0,0.08)',
            pointerEvents: 'none',
            zIndex: 50,
            maxWidth: 300,
            lineHeight: 1.35,
          }}
          dangerouslySetInnerHTML={{ __html: tooltip.html }}
        />
      )}
    </div>
  );
}
