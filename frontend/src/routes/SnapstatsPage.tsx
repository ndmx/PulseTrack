import React, { useEffect, useMemo, useState } from "react"
import { SnapStatsMap, Feature } from "../components/SnapStatsMap"
import SnapLeafletMap from "../components/SnapLeafletMap"
import { BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, ResponsiveContainer, Legend } from "recharts"
import TopNav from "../components/TopNav"
import Notice from "../components/Notice"

type ZoneStats = Record<string, { stateCount: number; totalArea: number }>

export default function SnapstatsPage() {
  const [tab, setTab] = useState<"interactive_map" | "data_table" | "zone_analysis">("interactive_map")
  const [features, setFeatures] = useState<Feature[]>([])
  const [error, setError] = useState<string | null>(null)
  const [tribes, setTribes] = useState<Array<{ Ethnic_Group: string; Estimated_Population_Millions: number; Percentage: number; Main_States: string; Main_Zones: string }>>([])
  const [search, setSearch] = useState<string>("")

  useEffect(() => {
    const url = import.meta.env.VITE_SNAPSTATS_GEOJSON_URL
    if (!url) { setError("Missing VITE_SNAPSTATS_GEOJSON_URL"); return }
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
    const url = import.meta.env.VITE_SNAPSTATS_TRIBE_STATS_URL as string | undefined
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
    const zUrl = import.meta.env.VITE_SNAPSTATS_ZONE_STATS_URL as string | undefined
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
    const pUrl = import.meta.env.VITE_SNAPSTATS_PARTY_STATS_URL as string | undefined
    if (pUrl) {
      fetch(pUrl).then(r=>r.json()).then((rows: any[]) => setPartyStats(rows)).catch(()=>{})
    }
  }, [])

  return (
    <div className="container" style={{ minHeight: "100vh" }}>
      <h1>🇳🇬 Snapstats</h1>
      <p>A fast, interactive dashboard for Nigeria's states — zones, tribes, parties, maps, and analytics.</p>

      <TopNav />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <button onClick={() => setTab("interactive_map")}>Interactive Map</button>
        <button onClick={() => setTab("data_table")}>Data Table</button>
        <button onClick={() => setTab("zone_analysis")}>Zone Analysis</button>
      </div>

      {error && <Notice type="error">We couldn’t load the map data. Please check your connection and try again.</Notice>}

      {tab === "interactive_map" && (
        <section>
          {/* Switch to Leaflet-based map */}
          <SnapLeafletMap />
        </section>
      )}

      {/* Static map removed */}

      {tab === "data_table" && (
        <section>
          <div style={{ overflow: "hidden", border: "1px solid #E9ECEF", borderRadius: 12 }}>
            <div style={{ padding: 12, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Search state, zone, party or tribe..."
                style={{ padding: '8px 10px', border: '1px solid #CED4DA', borderRadius: 8, minWidth: 240 }}
                onChange={(e) => setSearch(e.currentTarget.value)}
              />
              <span style={{ fontSize: 12, color: '#6C757D' }}>States: {features.length}</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F8F9FA' }}>
                    <th onClick={() => toggleSort('state')} style={{ position: 'sticky', left: 0, background: '#F8F9FA', cursor: 'pointer', textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid #E9ECEF' }}>State{sortMark('state')}</th>
                    <th onClick={() => toggleSort('zone')} style={{ cursor: 'pointer', textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid #E9ECEF' }}>Zone{sortMark('zone')}</th>
                    <th onClick={() => toggleSort('parties')} style={{ cursor: 'pointer', textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid #E9ECEF' }}>Parties{sortMark('parties')}</th>
                    <th onClick={() => toggleSort('tribes')} style={{ cursor: 'pointer', textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid #E9ECEF' }}>Tribes{sortMark('tribes')}</th>
                    <th onClick={() => toggleSort('area')} style={{ cursor: 'pointer', textAlign: 'right', padding: '10px 12px', borderBottom: '1px solid #E9ECEF' }}>Area (km²){sortMark('area')}</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedFeatures.map((f, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #F1F3F5' }}>
                      <td style={{ position: 'sticky', left: 0, background: '#fff', padding: '10px 12px' }}>{f.properties?.shapeName}</td>
                      <td style={{ padding: '10px 12px' }}>{f.properties?.Zone}</td>
                      <td style={{ padding: '10px 12px', color: '#495057' }}>{f.properties?.Typical_Parties}</td>
                      <td style={{ padding: '10px 12px', color: '#495057' }}>{f.properties?.Major_Tribes}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>{Number(f.properties?.area_km2 || 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {tab === "zone_analysis" && (
        <section>
          <h2>Zone Analysis</h2>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 320, height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={zoneBarData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                  <XAxis dataKey="zone" angle={-25} textAnchor="end" height={50} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="stateCount" name="States" fill="#007BFF" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ flex: 1, minWidth: 320, height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={zonePieData} nameKey="name" dataKey="value" innerRadius={60} outerRadius={100}>
                    {zonePieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={zoneColors[entry.name] || "#8884d8"} />
                    ))}
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <h3 style={{ marginTop: 20 }}>Tribal Analysis</h3>
          {tribes.length === 0 ? <p>Loading tribes...</p> : (
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 320, height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[...tribes].sort((a,b)=> b.Estimated_Population_Millions - a.Estimated_Population_Millions)} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                    <XAxis dataKey="Ethnic_Group" angle={-25} textAnchor="end" height={60} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Estimated_Population_Millions" name="Est. Pop (M)" fill="#28A745" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={{ flex: 1, minWidth: 320, height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={tribes.map(t=>({name:t.Ethnic_Group,value:t.Percentage}))} nameKey="name" dataKey="value" innerRadius={60} outerRadius={100}>
                      {tribes.map((t, i) => (
                        <Cell key={i} fill={["#0D6EFD","#198754","#FFC107","#DC3545","#6F42C1","#20C997","#FD7E14"][i % 7]} />
                      ))}
                    </Pie>
                    <Legend />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            <details>
              <summary>Source: tribes.csv</summary>
              <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(tribes.slice(0, 5), null, 2)}{tribes.length>5?"\n...":''}</pre>
            </details>
          </div>

          <h3 style={{ marginTop: 20 }}>Political Analysis</h3>
          {partyStats.length === 0 ? <p>Loading party stats...</p> : (
            <div style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[...partyStats].sort((a,b)=> b.stateCount - a.stateCount)} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                  <XAxis dataKey="party" angle={-25} textAnchor="end" height={60} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="stateCount" name="States" fill="#6F42C1" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
