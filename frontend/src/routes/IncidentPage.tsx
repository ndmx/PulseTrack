import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { categoryNames, getIncident, type SafetyIncident } from "../lib/safety"
import { timeLabel } from "./SafetyPage"
import SafetyHeader from "../components/SafetyHeader"
import "./safety.css"

export default function IncidentPage() {
  const { id = "" } = useParams()
  const [incident, setIncident] = useState<SafetyIncident | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [hidden, setHidden] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError("")
    setHidden(localStorage.getItem(`pulsetrack-hidden-${id}`) === "true")
    getIncident(id).then(item => { setIncident(item); setLoading(false) })
      .catch(cause => { setError(cause instanceof Error ? cause.message : "This report could not be loaded."); setLoading(false) })
  }, [id])

  async function copyLink() {
    try { await navigator.clipboard.writeText(window.location.href); setCopied(true) }
    catch { setCopied(false) }
  }

  function hide() {
    localStorage.setItem(`pulsetrack-hidden-${id}`, "true")
    setHidden(true)
  }

  return <div className="safety-site">
    <SafetyHeader />
    <main className="safety-detail-wrap">
      <Link className="safety-back" to="/feed">← Back to feed</Link>
      {loading ? <div className="safety-detail-card">Loading report…</div> : error ? <div className="safety-detail-card" role="alert">{error}</div> : !incident ? <div className="safety-detail-card"><h1>Report unavailable</h1><p>It may have expired or been removed.</p></div> : hidden ? <div className="safety-detail-card"><h1>Report hidden</h1><p>This report is hidden in your browser.</p><button className="safety-location-button" onClick={() => { localStorage.removeItem(`pulsetrack-hidden-${id}`); setHidden(false) }}>Show report again</button></div> : <article className="safety-detail-card">
        <div className="safety-detail-meta"><span className={`safety-severity severity-${incident.severity.toLowerCase()}`}>{incident.severity}</span><span>{categoryNames[incident.category]}</span><span>·</span><span>{timeLabel(incident.reportedAt)}</span></div>
        <h1>{incident.title}</h1>
        <p className="safety-detail-area">{incident.neighborhood}{incident.locationPending ? " · Public location withheld" : " · Approximate public location"}</p>
        <p className="safety-detail-summary">{incident.summary}</p>
        <div className="safety-detail-facts"><div><strong>{incident.status}</strong><span>Status</span></div><div><strong>{incident.confirmations}</strong><span>Seen</span></div><div><strong>{incident.disputes}</strong><span>Not seen</span></div><div><strong>{incident.officialUpdates}</strong><span>Official updates</span></div></div>
        <p className="safety-detail-caution">This is a community report. Counts and locations can change as people add information. Contact local emergency services directly if you need urgent help.</p>
        <div className="safety-detail-actions"><button className="safety-primary-button" onClick={copyLink}>{copied ? "Link copied" : "Copy link"}</button><button className="safety-location-button" onClick={hide}>Hide report</button><a className="safety-text-link" href="https://edentv.us/docs/pulsetrackr-support">Report a concern</a></div>
      </article>}
    </main>
    <footer className="safety-footer"><span>PulseTrackr by PulseTrack</span><span>Community awareness</span></footer>
  </div>
}
