import React, { useState } from "react"
import { ApprovalCards } from "./components/ApprovalCards"
import { SentimentPies } from "./components/SentimentPies"
import { Headlines } from "./components/Headlines"
import { SubmitOpinion } from "./components/SubmitOpinion"
import { useTrendsAllTime } from "./hooks/useTrendsAllTime"
import { useDemographics } from "./hooks/useDemographics"
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from "recharts"
import dayjs from "dayjs"

export default function App() {
  const trends = useTrendsAllTime()
  const demo = useDemographics()
  const [viewState, setViewState] = useState(false)
  const [selectedStates, setSelectedStates] = useState<string[]>([])

  return (
    <div className="container" style={{ minHeight: "100vh" }}>
      <h1>🇳🇬 PulseTrack</h1>
      

      <section>
        <h2>Current Approval (30 days, National)</h2>
        <ApprovalCards />
      </section>

      <section>
        <h2>Submit Your Opinion</h2>
        <SubmitOpinion />
      </section>

      <section>
        <h2>Sentiment Breakdown (Latest)</h2>
        <SentimentPies />
      </section>

      <section>
        <h2>Key Headlines Affecting Trends</h2>
        <Headlines />
      </section>

      <section>
        <h2>Approval Trends (All Time)</h2>
        <div style={{ height: 360 }}>
          {trends.isLoading ? <p>Loading...</p> : trends.isError ? <p>Error</p> : (() => {
            // Aggregate monthly averages and merge into single data array
            const bucket: Record<string, { month: string; tinubu?: number[]; obi?: number[] }> = {}
            for (const r of trends.data || []) {
              const m = dayjs(r.timestamp).startOf('month').format('YYYY-MM')
              const key = m
              if (!bucket[key]) bucket[key] = { month: m }
              const cand = (r.candidate || '').toLowerCase()
              if (cand === 'tinubu') {
                if (!bucket[key].tinubu) bucket[key].tinubu = []
                bucket[key].tinubu!.push(Number(r.rating_score) || 0)
              } else if (cand === 'obi') {
                if (!bucket[key].obi) bucket[key].obi = []
                bucket[key].obi!.push(Number(r.rating_score) || 0)
              }
            }
            const data = Object.values(bucket)
              .sort((a, b) => a.month.localeCompare(b.month))
              .map(row => ({
                month: row.month,
                tinubu: row.tinubu && row.tinubu.length ? row.tinubu.reduce((x, y) => x + y, 0) / row.tinubu.length : undefined,
                obi: row.obi && row.obi.length ? row.obi.reduce((x, y) => x + y, 0) / row.obi.length : undefined,
              }))
            return (
              <ResponsiveContainer width="99%" height="100%">
                <LineChart data={data} margin={{ top: 10, right: 56, bottom: 36, left: 16 }}>
                  <XAxis dataKey="month" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Legend verticalAlign="bottom" align="center" wrapperStyle={{ paddingTop: 8 }} />
                  <Line name="Tinubu" type="monotone" dataKey="tinubu" stroke="#007BFF" dot={false} connectNulls />
                  <Line name="Obi" type="monotone" dataKey="obi" stroke="#008753" dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            )
          })()}
        </div>
      </section>

      <section>
        <h2>State Demographics</h2>
        {/* Toggle and multiselect */}
        <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <input type="checkbox" checked={viewState} onChange={(e) => setViewState(e.target.checked)} /> View Specific States
        </label>

        {!demo.isLoading && !demo.isError && (
          <div style={{ marginTop: 12 }}>
            {viewState ? (
              <div>
                <select multiple value={selectedStates} onChange={(e) => setSelectedStates(Array.from(e.currentTarget.selectedOptions).map(o => o.value))} style={{ width: "100%", minHeight: 120 }}>
                  {demo.data?.map((r: any) => (
                    <option key={r.state} value={r.state}>{r.state}</option>
                  ))}
                </select>
                <div style={{ marginTop: 12 }}>
                  {selectedStates.length === 0 && <p>Select states to view details.</p>}
                  {selectedStates.map((st) => {
                    const rec = demo.data.find((r: any) => (r.state || "").toLowerCase() === st.toLowerCase())
                    if (!rec) return null
                    const rate = rec.voting_age_population ? (rec.registered_voters / rec.voting_age_population) * 100 : 0
                    return (
                      <div key={st} style={{ border: "1px solid #E9ECEF", borderRadius: 12, padding: 12, marginBottom: 12 }}>
                        <h3 style={{ marginTop: 0 }}>{st}</h3>
                        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                          <div><strong>Total Population</strong><div>{Number(rec.total_population).toLocaleString()}</div></div>
                          <div><strong>Registered Voters</strong><div>{Number(rec.registered_voters).toLocaleString()}</div></div>
                          <div><strong>Voter Registration Rate</strong><div>{rate.toFixed(1)}%</div></div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div>
                {(() => {
                  const totals = (demo.data || []).reduce((acc: any, r: any) => {
                    acc.total_population += Number(r.total_population || 0)
                    acc.voting_age_population += Number(r.voting_age_population || 0)
                    acc.registered_voters += Number(r.registered_voters || 0)
                    return acc
                  }, { total_population: 0, voting_age_population: 0, registered_voters: 0 })
                  const rate = totals.voting_age_population ? (totals.registered_voters / totals.voting_age_population) * 100 : 0
                  return (
                    <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 12 }}>
                      <div><strong>Total Population</strong><div>{totals.total_population.toLocaleString()}</div></div>
                      <div><strong>Registered Voters</strong><div>{totals.registered_voters.toLocaleString()}</div></div>
                      <div><strong>Voter Registration Rate</strong><div>{rate.toFixed(1)}%</div></div>
                    </div>
                  )
                })()}
                <div style={{ height: 420 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[...(demo.data || [])].sort((a: any,b: any)=> Number(b.registered_voters||0)-Number(a.registered_voters||0))} layout="vertical" margin={{ left: 40, right: 20, top: 10, bottom: 10 }}>
                      <XAxis type="number" tickFormatter={(v: number) => v >= 1_000_000 ? `${Math.round(v/1_000_000)}M` : v.toLocaleString()} />
                      <YAxis dataKey="state" type="category" width={100} />
                      <Tooltip />
                      <Bar dataKey="registered_voters" fill="#007BFF" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        )}
        {(demo.isLoading || demo.isError) && <p>{demo.isLoading ? "Loading..." : "Error"}</p>}
      </section>
    </div>
  )
}
