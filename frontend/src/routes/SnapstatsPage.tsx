import React, { useEffect, useMemo, useRef, useState } from "react"
import SnapLeafletMap from "../components/SnapLeafletMap"
import { BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, ResponsiveContainer, Legend } from "recharts"
import TopNav from "../components/TopNav"
import Notice from "../components/Notice"
import { SNAPSTATS_URLS } from "../lib/snapstatsConfig"

type Feature = {
  type: string
  properties?: Record<string, any>
  geometry: { type: string; coordinates: any }
}

type ZoneStats = Record<string, { stateCount: number; totalArea: number }>

type PipelineState = "live" | "syncing" | "degraded"

const formatLargeNumber = (value?: number) => {
  if (value === undefined || value === null || !Number.isFinite(value)) return "—"
  const abs = Math.abs(value)
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  return Math.round(value).toLocaleString()
}

export function SnapstatsView({ compact = false }: { compact?: boolean }) {
  const [tab, setTab] = useState<"interactive_map" | "data_table" | "zone_analysis">("interactive_map")
  const [features, setFeatures] = useState<Feature[]>([])
  const [error, setError] = useState<string | null>(null)
  const [tribes, setTribes] = useState<Array<{ Ethnic_Group: string; Estimated_Population_Millions: number; Percentage: number; Main_States: string; Main_Zones: string }>>([])
  const [search, setSearch] = useState<string>("")
  const mapSectionRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const url = SNAPSTATS_URLS.geojson
    if (!url) { setError("Missing SNAPSTATS GeoJSON URL"); return }
    fetch(url).then(r => r.json()).then(json => {
      const feats = (json.features || []) as Feature[]
      // ensure required props exist to avoid color fallback
      for (const f of feats) {
        if (!f.properties) f.properties = {}
        if (typeof f.properties.Zone === 'undefined' && typeof f.properties.zone !== 'undefined') {
          f.properties.Zone = f.properties.zone
        }
      }
      setFeatures(feats)
    }).catch(e => setError(String(e)))
  }, [])

  useEffect(() => {
    const url = SNAPSTATS_URLS.derived.tribeStats
    if (!url) return
    fetch(url)
      .then(r => r.json())
      .then((rows: any[]) => {
        const data = rows.map((rec: any) => ({
          Ethnic_Group: String(rec.Ethnic_Group || rec.ethnic_group || ''),
          Estimated_Population_Millions: Number(rec.Estimated_Population_Millions ?? rec.estimated_population_millions ?? 0),
          Percentage: Number(rec.Percentage ?? rec.percentage ?? 0),
          Main_States: String(rec.Main_States ?? rec.main_states ?? ''),
          Main_Zones: String(rec.Main_Zones ?? rec.main_zones ?? ''),
        }))
        setTribes(data)
      })
      .catch(() => {})
  }, [])

  const zoneColors: Record<string, string> = useMemo(() => ({
    "North Central": "#2E8B57",
    "North East": "#4169E1",
    "North West": "#DC143C",
    "South East": "#FF8C00",
    "South South": "#9932CC",
    "South West": "#FFD700"
  }), [])

  const [zoneBarData, setZoneBarData] = useState<Array<{ zone: string; stateCount: number }>>([])
  const [zonePieData, setZonePieData] = useState<Array<{ name: string; value: number }>>([])
  const [partyStats, setPartyStats] = useState<Array<{ party: string; stateCount: number }>>([])

  const filteredFeatures = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return features
    return features.filter(f => {
      const p = f.properties || {}
      return [p.shapeName, p.Zone, p.Typical_Parties, p.Major_Tribes]
        .filter(Boolean)
        .some((v: any) => String(v).toLowerCase().includes(q))
    })
  }, [features, search])

  const [sortKey, setSortKey] = useState<null | 'state' | 'zone' | 'area' | 'parties' | 'tribes'>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const sortedFeatures = useMemo(() => {
    if (!sortKey) return filteredFeatures
    const arr = [...filteredFeatures]
    const countTokens = (val?: any) => String(val || '').split(',').map((t: string) => t.trim()).filter(Boolean).length
    arr.sort((a, b) => {
      const pa = a.properties || {}
      const pb = b.properties || {}
      let va: any = 0, vb: any = 0
      if (sortKey === 'state') {
        va = String(pa.shapeName || '').toLowerCase(); vb = String(pb.shapeName || '').toLowerCase()
      } else if (sortKey === 'zone') {
        va = String(pa.Zone || '').toLowerCase(); vb = String(pb.Zone || '').toLowerCase()
      } else if (sortKey === 'area') {
        va = Number(pa.area_km2 || 0); vb = Number(pb.area_km2 || 0)
      } else if (sortKey === 'parties') {
        va = countTokens(pa.Typical_Parties); vb = countTokens(pb.Typical_Parties)
      } else if (sortKey === 'tribes') {
        va = countTokens(pa.Major_Tribes); vb = countTokens(pb.Major_Tribes)
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return arr
  }, [filteredFeatures, sortKey, sortDir])

  const toggleSort = (key: 'state' | 'zone' | 'area' | 'parties' | 'tribes') => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }
  const sortMark = (key: 'state' | 'zone' | 'area' | 'parties' | 'tribes') => sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''

  useEffect(() => {
    const zUrl = SNAPSTATS_URLS.derived.zoneStats
    if (zUrl) {
      fetch(zUrl).then(r=>r.json()).then((rows: any[]) => {
        setZoneBarData(rows.map(r=>({ zone: r.Zone ?? r.zone, stateCount: Number(r.stateCount||0) })))
        setZonePieData(rows.map(r=>({ name: r.Zone ?? r.zone, value: Number(r.totalArea||0) })))
      }).catch(()=>{})
    } else {
      // fallback: compute from features if env missing
      const stats: Record<string, { stateCount: number; totalArea: number }> = {}
      for (const f of features) {
        const zone = f.properties?.Zone || "Unknown"
        const area = Number(f.properties?.area_km2 || 0)
        if (!stats[zone]) stats[zone] = { stateCount: 0, totalArea: 0 }
        stats[zone].stateCount += 1
        stats[zone].totalArea += area
      }
      setZoneBarData(Object.entries(stats).map(([zone, s]) => ({ zone, stateCount: s.stateCount })))
      setZonePieData(Object.entries(stats).map(([zone, s]) => ({ name: zone, value: s.totalArea })))
    }
  }, [features])

  useEffect(() => {
    const pUrl = SNAPSTATS_URLS.derived.partyStats
    if (pUrl) {
      fetch(pUrl).then(r=>r.json()).then((rows: any[]) => setPartyStats(rows)).catch(()=>{})
    }
  }, [])

  const stateCount = features.length
  const zoneCoverage = useMemo(() => {
    const zones = new Set<string>()
    for (const feature of features) {
      const zone = feature.properties?.Zone
      if (zone) zones.add(String(zone))
    }
    return zones.size
  }, [features])

  const heroMetrics = useMemo(
    () => [
      { label: "States mapped", value: stateCount ? stateCount.toString().padStart(2, "0") : "—", helper: "GeoJSON features" },
      { label: "Zones covered", value: zoneCoverage ? zoneCoverage.toString() : "—", helper: "Geo-political zones" },
      { label: "Tribes tracked", value: tribes.length ? tribes.length.toString() : "—", helper: "Ethnic datasets" },
      { label: "Party sets", value: partyStats.length ? partyStats.length.toString() : "—", helper: "Dominant parties" },
    ],
    [partyStats.length, stateCount, tribes.length, zoneCoverage]
  )

  const datasetStatuses = useMemo(
    () =>
      [
        {
          label: "GeoJSON feed",
          state: error ? ("degraded" as PipelineState) : stateCount ? ("live" as PipelineState) : ("syncing" as PipelineState),
          detail: error ? "Failed to fetch boundary data" : stateCount ? `${stateCount} states online` : "Fetching boundaries",
        },
        {
          label: "Tribal stats",
          state: tribes.length ? ("live" as PipelineState) : ("syncing" as PipelineState),
          detail: tribes.length ? `${tribes.length} ethnic groups enriched` : "Loading tribe dataset",
        },
        {
          label: "Party dominance",
          state: partyStats.length ? ("live" as PipelineState) : ("syncing" as PipelineState),
          detail: partyStats.length ? "Party distribution ready" : "Waiting for derived stats",
        },
      ],
    [error, partyStats.length, stateCount, tribes.length]
  )

  const zoneLegend = useMemo(() => Object.entries(zoneColors), [zoneColors])

  const handleScrollToMap = () => {
    mapSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const layoutClass = compact ? "layout-grid snapstats-grid" : "container layout-grid"

  const heroBlock = compact ? null : (
    <header className="hero-band hero-band--snap">
      <div className="container hero-inner">
        <div className="hero-content">
          <p className="eyebrow">Nationwide Snapstats</p>
          <h1>See Nigeria&apos;s federated intelligence at a glance</h1>
          <p className="hero-lede">
            Territory boundaries, tribal concentrations, and political tilt — unified in a single control center so campaigns can plan faster.
          </p>
          <TopNav />
          <div className="hero-actions">
            <button type="button" className="btn btn-primary" onClick={handleScrollToMap}>
              View interactive map
            </button>
            <a className="btn btn-ghost" href="#snap-data-table">
              Browse dataset
            </a>
          </div>
          <div className="hero-metrics">
            {heroMetrics.map((metric) => (
              <div key={metric.label} className="metric-card">
                <span className="metric-label">{metric.label}</span>
                <strong className="metric-value">{metric.value}</strong>
                <span className="metric-helper">{metric.helper}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="hero-panel panel">
          <header className="section-heading compact">
            <div>
              <p className="section-eyebrow">Dataset pipelines</p>
              <h2>Always-on sync</h2>
            </div>
          </header>
          <ul className="status-list">
            {datasetStatuses.map((item) => (
              <li key={item.label}>
                <div>
                  <strong>{item.label}</strong>
                  <p className="muted">{item.detail}</p>
                </div>
                <span className={`status-pill status-${item.state}`}>{item.state}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </header>
  )

  const grid = (
    <div className={layoutClass}>
      <div className="grid-primary">
            <section className="panel" ref={mapSectionRef}>
              <header className="section-heading">
                <div>
                  <p className="section-eyebrow">Exploration</p>
                  <h2>Snapstats control center</h2>
                </div>
                <span className="section-note">Switch tabs to explore each layer</span>
              </header>

              <div className="pill-tabs">
                <button className={tab === "interactive_map" ? "active" : ""} onClick={() => setTab("interactive_map")}>
                  Interactive Map
                </button>
                <button className={tab === "data_table" ? "active" : ""} onClick={() => setTab("data_table")}>
                  Data Table
                </button>
                <button className={tab === "zone_analysis" ? "active" : ""} onClick={() => setTab("zone_analysis")}>
                  Zone Analysis
                </button>
              </div>

              <div className="tab-surface">
                {tab === "interactive_map" && (
                  <div className="map-shell">
                    {error ? <Notice type="error">We couldn’t load the map data. Please refresh and try again.</Notice> : <SnapLeafletMap />}
                  </div>
                )}

                {tab === "data_table" && (
                  <div id="snap-data-table" className="data-table-shell">
                    <div className="table-controls">
                      <input
                        type="text"
                        placeholder="Search state, zone, party or tribe..."
                        onChange={(e) => setSearch(e.currentTarget.value)}
                      />
                      <span className="muted small">States: {features.length}</span>
                    </div>
                    <div className="table-scroll">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th onClick={() => toggleSort("state")}>State{sortMark("state")}</th>
                            <th onClick={() => toggleSort("zone")}>Zone{sortMark("zone")}</th>
                            <th onClick={() => toggleSort("parties")}>Parties{sortMark("parties")}</th>
                            <th onClick={() => toggleSort("tribes")}>Tribes{sortMark("tribes")}</th>
                            <th onClick={() => toggleSort("area")} className="numeric">
                              Area (km²){sortMark("area")}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedFeatures.map((f, i) => (
                            <tr key={i}>
                              <td>{f.properties?.shapeName}</td>
                              <td>{f.properties?.Zone}</td>
                              <td>{f.properties?.Typical_Parties}</td>
                              <td>{f.properties?.Major_Tribes}</td>
                              <td className="numeric">{Number(f.properties?.area_km2 || 0).toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {tab === "zone_analysis" && (
                  <div className="zone-analysis">
                    <div className="split-grid">
                      <div className="panel-subcard tall-card">
                        <h3>States per zone</h3>
                        <ResponsiveContainer width="100%" height="85%">
                          <BarChart data={zoneBarData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                            <XAxis dataKey="zone" angle={-20} textAnchor="end" height={60} />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="stateCount" name="States" fill="#0FA958" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="panel-subcard tall-card">
                        <h3>Land area share</h3>
                        <ResponsiveContainer width="100%" height="85%">
                          <PieChart>
                            <Pie data={zonePieData} nameKey="name" dataKey="value" innerRadius={60} outerRadius={100}>
                              {zonePieData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={zoneColors[entry.name] || "#0D6EFD"} />
                              ))}
                            </Pie>
                            <Legend />
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <h3>Tribal analysis</h3>
                    {tribes.length === 0 ? (
                      <p className="muted">Loading tribal dataset…</p>
                    ) : (
                      <div className="split-grid">
                        <div className="panel-subcard tall-card">
                          <h4>Population by group</h4>
                          <ResponsiveContainer width="100%" height="80%">
                            <BarChart data={[...tribes].sort((a, b) => b.Estimated_Population_Millions - a.Estimated_Population_Millions)} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                              <XAxis dataKey="Ethnic_Group" angle={-20} textAnchor="end" height={70} />
                              <YAxis />
                              <Tooltip />
                              <Legend />
                              <Bar dataKey="Estimated_Population_Millions" name="Est. Pop (M)" fill="#198754" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="panel-subcard tall-card">
                          <h4>Share of population</h4>
                          <ResponsiveContainer width="100%" height="80%">
                            <PieChart>
                              <Pie data={tribes.map((t) => ({ name: t.Ethnic_Group, value: t.Percentage }))} nameKey="name" dataKey="value" innerRadius={60} outerRadius={100}>
                                {tribes.map((t, i) => (
                                  <Cell key={i} fill={["#0FA958", "#0D6EFD", "#FFC107", "#DC3545", "#6F42C1", "#20C997", "#FD7E14"][i % 7]} />
                                ))}
                              </Pie>
                              <Legend />
                              <Tooltip />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}

                    <h3>Political analysis</h3>
                    {partyStats.length === 0 ? (
                      <p className="muted">Loading party stats…</p>
                    ) : (
                      <div className="panel-subcard tall-card">
                        <ResponsiveContainer width="100%" height="90%">
                          <BarChart data={[...partyStats].sort((a, b) => b.stateCount - a.stateCount)} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                            <XAxis dataKey="party" angle={-20} textAnchor="end" height={70} />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="stateCount" name="States" fill="#6F42C1" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    <div className="data-source">
                      <details>
                        <summary>Source preview: tribes.csv</summary>
                        <pre>{JSON.stringify(tribes.slice(0, 5), null, 2)}{tribes.length > 5 ? "\n..." : ""}</pre>
                      </details>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>

          <aside className="grid-secondary">
            <section className="panel">
              <header className="section-heading">
                <div>
                  <p className="section-eyebrow">Zone palette</p>
                  <h2>Color key</h2>
                </div>
              </header>
              <ul className="legend-list">
                {zoneLegend.map(([zone, color]) => (
                  <li key={zone}>
                    <span style={{ background: color }} />
                    <div>
                      <strong>{zone}</strong>
                      <p className="muted small">Leaflet + chart palette</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
            <section className="panel">
              <header className="section-heading">
                <div>
                  <p className="section-eyebrow">Snapshot rollup</p>
                  <h2>Quick facts</h2>
                </div>
              </header>
              <div className="demo-summary">
                <div>
                  <span className="metric-label">Total population *</span>
                  <strong className="metric-value">{formatLargeNumber(features.reduce((acc, f) => acc + Number(f.properties?.total_population || 0), 0))}</strong>
                </div>
                <div>
                  <span className="metric-label">Zones</span>
                  <strong className="metric-value">{zoneCoverage || "—"}</strong>
                </div>
                <div>
                  <span className="metric-label">Party sets</span>
                  <strong className="metric-value">{partyStats.length || "—"}</strong>
                </div>
              </div>
              <p className="muted small">* Sum based on available static demographics.</p>
            </section>
            {compact && (
              <section className="panel">
                <header className="section-heading">
                  <div>
                    <p className="section-eyebrow">Dataset pipelines</p>
                    <h2>Sync health</h2>
                  </div>
                </header>
                <ul className="status-list">
                  {datasetStatuses.map((item) => (
                    <li key={item.label}>
                      <div>
                        <strong>{item.label}</strong>
                        <p className="muted">{item.detail}</p>
                      </div>
                      <span className={`status-pill status-${item.state}`}>{item.state}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </aside>
        </div>
  );

  if (compact) {
    return <div className="snapstats-embed">{grid}</div>
  }

  return (
    <div className="app-shell">
      {heroBlock}
      <main className="main-sections">{grid}</main>
    </div>
  )
}

export default function SnapstatsPage() {
  return <SnapstatsView />
}
