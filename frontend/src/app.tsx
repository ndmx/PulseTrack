import React, { useMemo, useRef, useState } from "react"
import dayjs from "dayjs"
import TopNav from "./components/TopNav"
import { SentimentPies } from "./components/SentimentPies"
import { Headlines } from "./components/Headlines"
import { SubmitOpinion } from "./components/SubmitOpinion"
import { useTrendsAllTime } from "./hooks/useTrendsAllTime"
import { useDemographics } from "./hooks/useDemographics"
import { useSentiment } from "./hooks/useSentiment"
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, Cell } from "recharts"
import Notice from "./components/Notice"
import { SnapstatsView } from "./routes/SnapstatsPage"

const formatLargeNumber = (value?: number) => {
  if (value === undefined || value === null || !Number.isFinite(value)) return "—"
  const abs = Math.abs(value)
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  return Math.round(value).toLocaleString()
}

const formatPercent = (value?: number) => {
  if (value === undefined || value === null || !Number.isFinite(value)) return "—"
  return `${value.toFixed(1)}%`
}

const partyColor = (p?: string) => {
  const k = String(p || "").toLowerCase()
  if (k.includes("apc")) return "#E53935"
  if (k.includes("pdp")) return "#00A86B"
  if (k.includes("lp") || k.includes("labour")) return "#DC143C"
  if (k.includes("nnpp")) return "#0D6EFD"
  return "#9E9E9E"
}

type PipelineState = "live" | "syncing" | "degraded"

export default function App() {
  const trends = useTrendsAllTime()
  const demo = useDemographics()
  const sentiments = useSentiment() as any
  const [viewState, setViewState] = useState(false)
  const [selectedStates, setSelectedStates] = useState<string[]>([])
  const opinionRef = useRef<HTMLElement | null>(null)

  const demoRows = useMemo(() => (Array.isArray(demo.data) ? (demo.data as any[]) : []), [demo.data])

  const nationalRollup = useMemo(
    () =>
      demoRows.reduce(
        (acc, row) => {
          acc.totalPopulation += Number(row.total_population || 0)
          acc.registeredVoters += Number(row.registered_voters || 0)
          acc.votingAgePopulation += Number(row.voting_age_population || 0)
          return acc
        },
        { totalPopulation: 0, registeredVoters: 0, votingAgePopulation: 0 }
      ),
    [demoRows]
  )

  const registrationRate = nationalRollup.votingAgePopulation
    ? (nationalRollup.registeredVoters / nationalRollup.votingAgePopulation) * 100
    : 0

  const heroMetrics = useMemo(
    () => [
      {
        label: "States tracked",
        value: demoRows.length ? demoRows.length.toString().padStart(2, "0") : "—",
        helper: "with complete demographic coverage",
      },
      {
        label: "Registered voters in scope",
        value: formatLargeNumber(nationalRollup.registeredVoters),
        helper: "latest synced snapshot",
      },
      {
        label: "Population coverage",
        value: formatLargeNumber(nationalRollup.totalPopulation),
        helper: "across all uploaded states",
      },
      {
        label: "Registration rate",
        value: formatPercent(registrationRate),
        helper: "voting-age vs. registered",
      },
    ],
    [demoRows.length, nationalRollup.registeredVoters, nationalRollup.totalPopulation, registrationRate]
  )

  const trendChartData = useMemo(() => {
    if (!Array.isArray(trends.data)) return []
    const bucket: Record<string, { month: string; tinubu?: number; obi?: number; atiku?: number }> = {}
    for (const row of trends.data as any[]) {
      const candidate = (row.candidate || "").toLowerCase()
      const sourceMonth = row.bucket_month || row.bucket_day || (row.timestamp ? dayjs(row.timestamp).format("YYYY-MM") : undefined)
      if (!sourceMonth) continue
      if (!bucket[sourceMonth]) bucket[sourceMonth] = { month: sourceMonth }
      const avg = Number(row.avg_rating ?? row.rating_score ?? 0)
      if (!Number.isFinite(avg)) continue
      if (candidate.includes("tinubu")) bucket[sourceMonth].tinubu = avg
      else if (candidate.includes("obi")) bucket[sourceMonth].obi = avg
      else if (candidate.includes("atiku")) bucket[sourceMonth].atiku = avg
    }
    return Object.values(bucket).sort((a, b) => a.month.localeCompare(b.month))
  }, [trends.data])

  const sortedDemographics = useMemo(
    () => [...demoRows].sort((a, b) => Number(b.registered_voters || 0) - Number(a.registered_voters || 0)),
    [demoRows]
  )

  const stateOptions = useMemo(
    () => demoRows.map((r) => String(r.state || "")).filter(Boolean).sort((a, b) => a.localeCompare(b)),
    [demoRows]
  )

  const pipelineStatuses = useMemo(
    () =>
      [
        {
          label: "Approval trends feed",
          state: trends.isError ? ("degraded" as PipelineState) : trends.isLoading ? ("syncing" as PipelineState) : ("live" as PipelineState),
          detail: trends.isError
            ? "Firestore query interrupted — retrying"
            : trends.isLoading
              ? "Pulling latest monthly buckets"
              : "Hourly aggregation healthy",
        },
        {
          label: "Demographics dataset",
          state: demo.isError ? ("degraded" as PipelineState) : demo.isLoading ? ("syncing" as PipelineState) : ("live" as PipelineState),
          detail: demo.isError ? "Check Snapstats sync job" : demo.isLoading ? "Loading state profiles" : "Static assets in sync",
        },
        {
          label: "Submission intake",
          state: "live" as PipelineState,
          detail: "HTTPS function protected by API key",
        },
      ] as Array<{ label: string; state: PipelineState; detail: string }>,
    [demo.isError, demo.isLoading, trends.isError, trends.isLoading]
  )

  const handleScrollToOpinion = () => {
    if (opinionRef.current) {
      opinionRef.current.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }

  const heroTrendSummary = useMemo(() => {
    if (!trendChartData.length) return null
    const latest = trendChartData[trendChartData.length - 1] as any
    const previous = trendChartData.length > 1 ? (trendChartData[trendChartData.length - 2] as any) : null
    const candidateLabels: Record<string, string> = {
      tinubu: "Bola Tinubu",
      obi: "Peter Obi",
      atiku: "Atiku Abubakar",
    }
    let bestKey: string | null = null
    let bestValue = -Infinity
    for (const key of Object.keys(candidateLabels)) {
      const value = Number(latest[key])
      if (Number.isFinite(value) && value > bestValue) {
        bestValue = value
        bestKey = key
      }
    }
    if (!bestKey || !Number.isFinite(bestValue)) return null
    const prevValue = previous ? Number(previous[bestKey]) : undefined
    return {
      candidateKey: bestKey,
      candidateName: candidateLabels[bestKey] ?? bestKey,
      rating: bestValue,
      delta: Number.isFinite(prevValue) ? bestValue - Number(prevValue) : undefined,
      bucketLabel: latest.month,
    }
  }, [trendChartData])

  const topSentiment = useMemo(() => {
    if (!sentiments?.data || !Array.isArray(sentiments.data) || sentiments.data.length === 0) return null
    if (!heroTrendSummary) return null
    const match = sentiments.data.find(
      (row: any) => String(row.candidate || "").toLowerCase() === heroTrendSummary.candidateName.toLowerCase()
    )
    return match || null
  }, [sentiments?.data, heroTrendSummary])

  const sentimentPercents = useMemo(() => {
    if (!topSentiment) return null
    const normalize = (value: number) => {
      if (!Number.isFinite(value)) return 0
      return value <= 1 ? value * 100 : value
    }
    return {
      positive: normalize(Number(topSentiment.positive ?? 0)),
      neutral: normalize(Number(topSentiment.neutral ?? 0)),
      negative: normalize(Number(topSentiment.negative ?? 0)),
    }
  }, [topSentiment])

  const heroHeadline = topSentiment?.headlines || "No recent headline for this candidate. Tracking will update after the next ETL cycle."

  return (
    <div className="app-shell">
      <header className="hero-band hero-band--pulse">
        <div className="container hero-inner">
          <div className="hero-content">
            <p className="eyebrow">Realtime civic intelligence</p>
            <h1>Gauge Nigeria&apos;s pulse in one place</h1>
            <p className="hero-lede">
              PulseTrack blends grassroots submissions, ETL scoring, and Snapstats depth so teams can react faster without hopping between tools.
            </p>
            <TopNav />
            <div className="hero-actions">
              <button type="button" className="btn btn-primary" onClick={handleScrollToOpinion}>
                Share your opinion
              </button>
              <a className="btn btn-ghost" href="#demographics">
                Explore demographics
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
                <p className="section-eyebrow">Current approval</p>
                <h2>Updated {dayjs().format("MMM D, YYYY")}</h2>
              </div>
            </header>
            {trends.isLoading && <p className="muted">Loading approval insights…</p>}
            {trends.isError && <Notice type="error">We could not load approval trends right now. Please refresh.</Notice>}
            {heroTrendSummary && (
              <div className="hero-approval">
                <div className="hero-approval__score">
                  <span className="metric-label">Top performer</span>
                  <div className="hero-approval__candidate">{heroTrendSummary.candidateName}</div>
                  <div className="hero-approval__rating">
                    {Number(heroTrendSummary.rating || 0).toFixed(1)}
                    <span>% approval</span>
                  </div>
                  {typeof heroTrendSummary.delta === "number" && (
                    <div className={`hero-approval__delta ${heroTrendSummary.delta >= 0 ? "positive" : "negative"}`}>
                      {heroTrendSummary.delta >= 0 ? "+" : ""}
                      {heroTrendSummary.delta.toFixed(1)} vs previous point
                    </div>
                  )}
                  <p className="muted small" style={{ marginTop: 8 }}>
                    Latest period: {heroTrendSummary.bucketLabel}
                  </p>
                </div>
                {topSentiment && sentimentPercents && (
                  <div className="hero-approval__sentiment">
                    <div>
                      <span className="metric-label">Sentiment</span>
                      <div className="sentiment-bars">
                        <span className="pos" style={{ width: `${sentimentPercents.positive}%` }} />
                        <span className="neu" style={{ width: `${sentimentPercents.neutral}%` }} />
                        <span className="neg" style={{ width: `${sentimentPercents.negative}%` }} />
                      </div>
                      <div className="sentiment-labels">
                        <span>Positive {sentimentPercents.positive.toFixed(0)}%</span>
                        <span>Neutral {sentimentPercents.neutral.toFixed(0)}%</span>
                        <span>Negative {sentimentPercents.negative.toFixed(0)}%</span>
                      </div>
                    </div>
                    <div className="hero-approval__headline">
                      <span className="metric-label">Key headline</span>
                      <p>{heroHeadline}</p>
                    </div>
                  </div>
                )}
                {!topSentiment && <p className="muted">No sentiment snapshot available for this candidate yet.</p>}
              </div>
            )}
            {!heroTrendSummary && !trends.isLoading && !trends.isError && (
              <p className="muted">No approval trend snapshots available yet. Submit opinions or ingest data to populate this module.</p>
            )}
          </div>
        </div>
      </header>

      <main className="main-sections">
        <div className="container layout-grid">
          <div className="grid-primary">
            <section className="panel">
              <header className="section-heading">
                <div>
                  <p className="section-eyebrow">Sentiment &amp; narrative</p>
                  <h2>How supporters feel right now</h2>
                </div>
                <span className="section-note">Refreshed hourly</span>
              </header>
              <div className="split-grid">
                <div className="panel-subcard">
                  <h3>Sentiment mix</h3>
                  <SentimentPies />
                </div>
                <div className="panel-subcard">
                  <h3>Key headlines</h3>
                  <Headlines />
                </div>
              </div>
            </section>

            <section className="panel">
              <header className="section-heading">
                <div>
                  <p className="section-eyebrow">Pulse over time</p>
                  <h2>Approval trends</h2>
                </div>
                <span className="section-note">All candidates</span>
              </header>
              <div className="chart-shell">
                {trends.isLoading ? (
                  <p className="muted">Loading approval trends…</p>
                ) : trends.isError ? (
                  <Notice type="error">We couldn’t load approval trends right now. Please refresh.</Notice>
                ) : (
                  <div style={{ height: 360 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trendChartData} margin={{ top: 10, right: 56, bottom: 36, left: 16 }}>
                        <XAxis dataKey="month" />
                        <YAxis domain={[0, 100]} />
                        <Tooltip />
                        <Legend verticalAlign="bottom" align="center" wrapperStyle={{ paddingTop: 8 }} />
                        <Line name="Tinubu" type="monotone" dataKey="tinubu" stroke="#007BFF" dot={false} connectNulls />
                        <Line name="Obi" type="monotone" dataKey="obi" stroke="#008753" dot={false} connectNulls />
                        <Line name="Atiku" type="monotone" dataKey="atiku" stroke="#DC3545" dot={false} connectNulls />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </section>

            <section className="panel" id="demographics">
              <header className="section-heading">
                <div>
                  <p className="section-eyebrow">State intelligence</p>
                  <h2>Demographics &amp; voter strength</h2>
                </div>
                <span className="section-note">Synced nightly</span>
              </header>

              <div className="demo-toggle">
                <label className="toggle">
                  <input type="checkbox" checked={viewState} onChange={(e) => setViewState(e.target.checked)} />
                  <span>Focus on specific states</span>
                </label>
              </div>

              {demo.isLoading && <p className="muted">Loading demographics…</p>}
              {demo.isError && <Notice type="error">We couldn’t load demographics right now. Please try again later.</Notice>}

              {!demo.isLoading && !demo.isError && (
                <div className="demo-section">
                  {viewState ? (
                    <div className="state-selector">
                      <select
                        multiple
                        value={selectedStates}
                        onChange={(e) => setSelectedStates(Array.from(e.currentTarget.selectedOptions).map((o) => o.value))}
                        className="state-multi"
                      >
                        {stateOptions.map((state) => (
                          <option key={state} value={state}>
                            {state}
                          </option>
                        ))}
                      </select>
                      {selectedStates.length === 0 ? (
                        <p className="muted">Pick states above to see population, voter strength, and turnout readiness.</p>
                      ) : (
                        <div className="demo-state-grid">
                          {selectedStates.map((state) => {
                            const rec = demoRows.find((r: any) => (r.state || "").toLowerCase() === state.toLowerCase())
                            if (!rec) return null
                            const rate = rec.voting_age_population
                              ? (Number(rec.registered_voters || 0) / Number(rec.voting_age_population || 0)) * 100
                              : 0
                            return (
                              <div key={state} className="state-card">
                                <div className="state-card-head">
                                  <span className="state-label">{rec.zone || "Zone"}</span>
                                  <h4>{state}</h4>
                                </div>
                                <div className="state-card-metrics">
                                  <div>
                                    <span className="metric-label">Population</span>
                                    <strong>{formatLargeNumber(Number(rec.total_population || 0))}</strong>
                                  </div>
                                  <div>
                                    <span className="metric-label">Registered voters</span>
                                    <strong>{formatLargeNumber(Number(rec.registered_voters || 0))}</strong>
                                  </div>
                                  <div>
                                    <span className="metric-label">Registration rate</span>
                                    <strong>{formatPercent(rate)}</strong>
                                  </div>
                                </div>
                                <p className="muted small">
                                  Dominant party: {rec.political_affiliation || "N/A"} · Lead tribe: {rec.tribal_affiliation || "N/A"}
                                </p>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="demo-summary">
                        <div>
                          <span className="metric-label">Total population</span>
                          <strong className="metric-value">{formatLargeNumber(nationalRollup.totalPopulation)}</strong>
                        </div>
                        <div>
                          <span className="metric-label">Registered voters</span>
                          <strong className="metric-value">{formatLargeNumber(nationalRollup.registeredVoters)}</strong>
                        </div>
                        <div>
                          <span className="metric-label">Registration rate</span>
                          <strong className="metric-value">{formatPercent(registrationRate)}</strong>
                        </div>
                      </div>
                      {sortedDemographics.length === 0 ? (
                        <p className="muted">No demographic data available.</p>
                      ) : (
                        <>
                          <div className="chart-shell tall">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={sortedDemographics} layout="vertical" margin={{ left: 40, right: 20, top: 10, bottom: 10 }}>
                                <XAxis type="number" tickFormatter={(v: number) => (v >= 1_000_000 ? `${Math.round(v / 1_000_000)}M` : v.toLocaleString())} />
                                <YAxis dataKey="state" type="category" width={120} />
                                <Tooltip />
                                <Bar dataKey="registered_voters" name="Registered voters">
                                  {sortedDemographics.map((row: any, i: number) => (
                                    <Cell key={row.state || i} fill={partyColor(row.political_affiliation)} />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="party-key">
                            <span><strong>Party colors:</strong></span>
                            <span><span style={{ background: "#E53935" }} /> APC</span>
                            <span><span style={{ background: "#00A86B" }} /> PDP</span>
                            <span><span style={{ background: "#DC143C" }} /> LP</span>
                            <span><span style={{ background: "#0D6EFD" }} /> NNPP</span>
                            <span><span style={{ background: "#9E9E9E" }} /> Mixed</span>
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>
              )}
            </section>

            <section className="panel" id="snapstats">
              <header className="section-heading">
                <div>
                  <p className="section-eyebrow">Nationwide intelligence</p>
                  <h2>Snapstats deep dive</h2>
                </div>
                <span className="section-note">Map, tables, and zone analytics</span>
              </header>
              <SnapstatsView compact />
            </section>
          </div>

          <aside className="grid-secondary">
            <section className="panel sticky-panel" ref={opinionRef}>
              <header className="section-heading">
                <div>
                  <p className="section-eyebrow">Community channel</p>
                  <h2>Share your opinion</h2>
                </div>
                <span className="section-note">Takes 60 seconds</span>
              </header>
              <p className="muted">
                Every submission is sanitized, geotagged, and routed through the secure HTTPS function before it feeds the ETL. Add your voice and help keep the signal fresh.
              </p>
              <div className="opinion-form">
                <SubmitOpinion />
              </div>
            </section>

            <section className="panel">
              <header className="section-heading">
                <div>
                  <p className="section-eyebrow">Ops glance</p>
                  <h2>Data pipeline health</h2>
                </div>
              </header>
              <ul className="status-list">
                {pipelineStatuses.map((item) => (
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
          </aside>
        </div>
      </main>
    </div>
  )
}
