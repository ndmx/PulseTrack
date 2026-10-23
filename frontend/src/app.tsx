import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import TopNav from "./components/TopNav"
import Notice from "./components/Notice"
import { useDemographics } from "./hooks/useDemographics"
import { SNAPSTATS_URLS } from "./lib/snapstatsConfig"

type TribeEstimate = { Ethnic_Group: string; Percentage: number; Main_States: string }
const number = (value: unknown) => Number(value) || 0
const compact = (value: number) => value ? new Intl.NumberFormat("en-NG", { notation: "compact", maximumFractionDigits: 1 }).format(value) : "—"
const full = (value: number) => value ? new Intl.NumberFormat("en-NG").format(value) : "—"

export default function App() {
  const demographics = useDemographics()
  const [selectedState, setSelectedState] = useState("")
  const [tribes, setTribes] = useState<TribeEstimate[]>([])
  const [tribeError, setTribeError] = useState(false)

  useEffect(() => {
    let active = true
    fetch(SNAPSTATS_URLS.derived.tribeStats)
      .then((response) => {
        if (!response.ok) throw new Error("Community data unavailable")
        return response.json()
      })
      .then((rows: TribeEstimate[]) => { if (active) setTribes(rows) })
      .catch(() => { if (active) setTribeError(true) })
    return () => { active = false }
  }, [])

  const rows = useMemo(() => demographics.data ?? [], [demographics.data])
  const sortedRows = useMemo(() => [...rows].sort((a, b) => number(b.registered_voters) - number(a.registered_voters)), [rows])
  const stateOptions = useMemo(() => [...rows].sort((a, b) => String(a.state).localeCompare(String(b.state))), [rows])
  const totals = useMemo(() => rows.reduce((sum, row) => ({
    population: sum.population + number(row.total_population),
    votingAge: sum.votingAge + number(row.voting_age_population),
    registered: sum.registered + number(row.registered_voters),
  }), { population: 0, votingAge: 0, registered: 0 }), [rows])
  const currentState = rows.find((row) => row.state === selectedState)
  const topVoters = sortedRows.slice(0, 10)
  const maxVoters = number(topVoters[0]?.registered_voters)

  return <div className="app-shell">
    <header className="hero-band hero-band--pulse"><div className="container">
      <TopNav />
      <p className="eyebrow">Nigeria · Civic data</p>
      <h1 className="civic-title">Voter &amp; community data</h1>
      <p className="hero-lede">Explore registered voters, state populations, and existing community estimates.</p>
      <div className="hero-actions"><a className="btn btn-primary" href="#states">Explore states</a><Link className="btn btn-ghost" to="/snapstats">Open map explorer</Link></div>
      <div className="hero-metrics" aria-label="National data summary">
        <div className="metric-card"><span className="metric-label">Areas in dataset</span><strong className="metric-value">{rows.length || "—"}</strong><span className="metric-helper">States and FCT where available</span></div>
        <div className="metric-card"><span className="metric-label">Registered voters</span><strong className="metric-value">{compact(totals.registered)}</strong><span className="metric-helper">Sum of available state records</span></div>
        <div className="metric-card"><span className="metric-label">Voting age population</span><strong className="metric-value">{compact(totals.votingAge)}</strong><span className="metric-helper">Sum of available state records</span></div>
        <div className="metric-card"><span className="metric-label">Total population</span><strong className="metric-value">{compact(totals.population)}</strong><span className="metric-helper">Sum of available state records</span></div>
      </div>
    </div></header>

    <main className="main-sections container civic-data">
      {demographics.isLoading && <p className="muted">Loading state data…</p>}
      {demographics.isError && <Notice type="error">State data is unavailable right now. Please try again later.</Notice>}
      <section className="panel" id="states">
        <header className="section-heading"><div><p className="section-eyebrow">State records</p><h2>Registered voters by state</h2></div><span className="section-note">Top 10 in this dataset</span></header>
        <p className="muted small">These figures are from the existing PulseTrack state dataset. Confirm dates and methodology with the original source before using them for election decisions.</p>
        {topVoters.length > 0 && <ol className="voter-bars">{topVoters.map((row) => <li key={row.id}>
          <span className="voter-bar-name">{row.state}</span><span className="voter-bar-track"><span style={{ width: String(maxVoters ? number(row.registered_voters) / maxVoters * 100 : 0) + "%" }} /></span><strong>{compact(number(row.registered_voters))}</strong>
        </li>)}</ol>}
      </section>
      <div className="civic-columns">
        <section className="panel">
          <header className="section-heading"><div><p className="section-eyebrow">Compare one area</p><h2>State details</h2></div></header>
          <label className="civic-select-label" htmlFor="civic-state">Choose a state or FCT</label>
          <select id="civic-state" className="civic-select" value={selectedState} onChange={(event) => setSelectedState(event.target.value)}><option value="">Select an area</option>{stateOptions.map((row) => <option key={row.id} value={row.state}>{row.state}</option>)}</select>
          {currentState ? <dl className="civic-details">
            <div><dt>Registered voters</dt><dd>{full(number(currentState.registered_voters))}</dd></div>
            <div><dt>Voting age population</dt><dd>{full(number(currentState.voting_age_population))}</dd></div>
            <div><dt>Total population</dt><dd>{full(number(currentState.total_population))}</dd></div>
            <div><dt>Zone</dt><dd>{currentState.zone || "—"}</dd></div>
            <div><dt>Community field</dt><dd>{currentState.tribal_affiliation || "—"}</dd></div>
          </dl> : <p className="muted">Select an area to view its existing voter and community fields.</p>}
        </section>
        <section className="panel">
          <header className="section-heading"><div><p className="section-eyebrow">Community estimates</p><h2>Ethnic groups in the dataset</h2></div></header>
          <p className="muted small">Existing population estimates, shown for geographic context. These are not voter preferences or predictions.</p>
          {tribeError && <Notice type="error">Community estimates are unavailable right now.</Notice>}
          {tribes.length > 0 && <div className="civic-table-wrap"><table className="civic-table"><thead><tr><th>Group</th><th>Estimated share</th><th>Main states listed</th></tr></thead><tbody>{tribes.map((tribe) => <tr key={tribe.Ethnic_Group}><th scope="row">{tribe.Ethnic_Group}</th><td>{number(tribe.Percentage).toFixed(1)}%</td><td>{tribe.Main_States.replace(/,/g, ", ")}</td></tr>)}</tbody></table></div>}
          <Link className="civic-explorer-link" to="/snapstats">Explore all geographic data →</Link>
        </section>
      </div>
    </main>
  </div>
}
