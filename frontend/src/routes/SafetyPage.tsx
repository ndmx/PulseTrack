import { useCallback, useEffect, useMemo, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import SafetyMap from "../components/SafetyMap"
import SafetyHeader from "../components/SafetyHeader"
import { categoryNames, reportingAvailable, submitReport, subscribeIncidents, type IncidentCategory, type IncidentSeverity, type ReportDraft, type SafetyIncident } from "../lib/safety"
import "./safety.css"

const filters: Array<"all" | IncidentCategory> = ["all", ...Object.keys(categoryNames) as IncidentCategory[]]

function distanceKm(a: [number, number], b: [number, number]) {
  const radians = Math.PI / 180
  const lat = (b[0] - a[0]) * radians
  const lon = (b[1] - a[1]) * radians
  const value = Math.sin(lat / 2) ** 2 + Math.cos(a[0] * radians) * Math.cos(b[0] * radians) * Math.sin(lon / 2) ** 2
  return 12742 * Math.asin(Math.min(1, Math.sqrt(value)))
}

export function timeLabel(date: Date | null) {
  if (!date) return "Time unavailable"
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000))
  if (minutes < 2) return "Just now"
  if (minutes < 60) return `${minutes}m ago`
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function ReportDialog({ onClose, onCreated }: { onClose: () => void, onCreated: (id: string) => void }) {
  const [title, setTitle] = useState("")
  const [summary, setSummary] = useState("")
  const [category, setCategory] = useState<IncidentCategory>("community")
  const [severity, setSeverity] = useState<IncidentSeverity>("Medium")
  const [neighborhood, setNeighborhood] = useState("")
  const [coordinate, setCoordinate] = useState<[number, number] | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose() }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [onClose])

  function locate() {
    if (!navigator.geolocation) { setMessage("This browser cannot provide a location."); return }
    setMessage("Requesting location…")
    navigator.geolocation.getCurrentPosition(
      position => {
        setCoordinate([position.coords.latitude, position.coords.longitude])
        setMessage("Location added. The public report will use the app's location privacy policy.")
      },
      () => setMessage("Location is required to submit a report. Allow location access and try again."),
      { enableHighAccuracy: true, timeout: 15000 },
    )
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!coordinate) { setMessage("Add your location before sending the report."); return }
    const draft: ReportDraft = {
      title: title.trim(), summary: summary.trim(), category, severity,
      neighborhood: neighborhood.trim() || "Nearby area",
      latitude: coordinate[0], longitude: coordinate[1],
    }
    if (draft.title.length < 4 || draft.summary.length < 10) {
      setMessage("Add a title of at least 4 characters and details of at least 10 characters.")
      return
    }
    setBusy(true)
    setMessage("")
    try { onCreated(await submitReport(draft)) }
    catch (error) { setMessage(error instanceof Error ? error.message : "The report could not be sent. Please try again.") }
    finally { setBusy(false) }
  }

  return <div className="safety-dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className="safety-dialog" role="dialog" aria-modal="true" aria-labelledby="report-heading">
      <div className="safety-dialog-head"><div><p className="safety-eyebrow">New community report</p><h2 id="report-heading">Report an incident</h2></div><button type="button" className="safety-icon-button" onClick={onClose} aria-label="Close report form">×</button></div>
      <p className="safety-muted">Share what happened and where. Your current location is required to send a report.</p>
      <form onSubmit={submit} className="safety-form">
        <button autoFocus type="button" className="safety-location-button" onClick={locate}>{coordinate ? "Location added · Update" : "Add current location (required)"}</button>
        {message && <p role="status" className="safety-form-message">{message}</p>}
        <label>Short title<input required maxLength={120} value={title} onChange={event => setTitle(event.target.value)} placeholder="What happened?" /></label>
        <label>Details<textarea required maxLength={2000} rows={4} value={summary} onChange={event => setSummary(event.target.value)} placeholder="Include useful details without naming private individuals." /></label>
        <div className="safety-form-row">
          <label>Category<select value={category} onChange={event => setCategory(event.target.value as IncidentCategory)}>{Object.entries(categoryNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Severity<select value={severity} onChange={event => setSeverity(event.target.value as IncidentSeverity)}>{["Low", "Medium", "High", "Urgent"].map(value => <option key={value}>{value}</option>)}</select></label>
        </div>
        <label>Area or landmark<input maxLength={120} value={neighborhood} onChange={event => setNeighborhood(event.target.value)} placeholder="Optional" /></label>
        <p className="safety-fineprint">Your exact location is used by the backend for validation. Public location is revealed only under the app's privacy policy. Do not use PulseTrack to request emergency help.</p>
        <button className="safety-primary-button" type="submit" disabled={busy}>{busy ? "Sending report…" : "Send report"}</button>
      </form>
    </section>
  </div>
}

export default function SafetyPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [incidents, setIncidents] = useState<SafetyIncident[]>([])
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState<"all" | IncidentCategory>("all")
  const [search, setSearch] = useState("")
  const [center, setCenter] = useState<[number, number] | null>(null)
  const [nearbyOnly, setNearbyOnly] = useState(false)
  const [mobileView, setMobileView] = useState<"feed" | "map">(location.pathname === "/feed" ? "feed" : "map")
  const [showReport, setShowReport] = useState(false)
  const [locationMessage, setLocationMessage] = useState("")

  useEffect(() => subscribeIncidents(
    items => { setIncidents(items); setLoading(false); setError("") },
    cause => { setLoading(false); setError(cause.message || "Live reports could not be loaded.") },
  ), [])

  useEffect(() => { setMobileView(location.pathname === "/feed" ? "feed" : "map") }, [location.pathname])
  useEffect(() => { if (reportingAvailable && new URLSearchParams(location.search).has("report")) setShowReport(true) }, [location.search])

  const filtered = useMemo(() => incidents.filter(incident => {
    if (category !== "all" && incident.category !== category) return false
    if (nearbyOnly && center) {
      if (incident.latitude === null || incident.longitude === null) return false
      if (distanceKm(center, [incident.latitude, incident.longitude]) > 25) return false
    }
    const queryText = search.trim().toLowerCase()
    return !queryText || [incident.title, incident.summary, incident.neighborhood, incident.category].some(value => value.toLowerCase().includes(queryText))
  }), [incidents, category, search, nearbyOnly, center])
  const publicLocationCount = filtered.filter(item => !item.locationPending && item.latitude !== null && item.longitude !== null).length

  const selectIncident = useCallback((id: string) => navigate(`/incident/${encodeURIComponent(id)}`), [navigate])

  function locate() {
    if (!navigator.geolocation) { setLocationMessage("Location is unavailable in this browser."); return }
    setLocationMessage("Finding your location…")
    navigator.geolocation.getCurrentPosition(position => {
      setCenter([position.coords.latitude, position.coords.longitude])
      setNearbyOnly(true)
      setLocationMessage("Showing reports within 25 km of you from the latest live reports.")
    }, () => setLocationMessage("Location access was not granted. You can still browse recent reports."), { timeout: 12000 })
  }

  return <div className="safety-site">
    <SafetyHeader onReport={() => setShowReport(true)} />
    <main className="safety-main">
      <section className="safety-intro"><div><p className="safety-eyebrow">PulseTrackr · Community safety</p><h1>{mobileView === "feed" ? "Community feed" : "Safety around you"}</h1><p>See public incident reports from the last 24 hours. Choose a report to read its details, or share what you have witnessed.</p></div><div className="safety-intro-actions"><button type="button" className="safety-location-button" onClick={locate}>{nearbyOnly ? "Update location" : "Near me"}</button>{reportingAvailable && <button type="button" className="safety-primary-button" onClick={() => setShowReport(true)}>Report an incident</button>}</div></section>
      <div className="safety-disclaimer"><strong>Before you act</strong><span>Community reports may be unconfirmed. For immediate danger, contact local emergency services.</span></div>
      <section className={`safety-workspace safety-workspace--${mobileView}`} aria-label="Live incident map and feed">
        <div className={`safety-map-panel ${mobileView === "feed" ? "safety-mobile-hidden" : ""}`}><div className="safety-map-head"><div><p className="safety-eyebrow">Live map</p><h2>Map</h2></div><span>{publicLocationCount} public {publicLocationCount === 1 ? "location" : "locations"}</span></div><div className="safety-map-wrap"><SafetyMap incidents={filtered} center={center} onSelect={selectIncident} visible={mobileView === "map"} /></div><div className="safety-map-foot">{publicLocationCount === 0 ? "No public report locations in the last 24 hours. Use Near me to center on your area." : "Pins use approximate public locations. Some reports stay off the map to protect privacy."}</div></div>
        <div className={`safety-feed ${mobileView === "map" ? "safety-mobile-hidden" : ""}`}>
          <div className="safety-feed-head"><div><p className="safety-eyebrow">Last 24 hours</p><h2>Latest reports</h2></div><span className="safety-count">{filtered.length} {filtered.length === 1 ? "report" : "reports"}</span></div>
          {incidents.length > 0 && <div className="safety-tools"><label className="safety-search"><span className="safety-control-label">Search</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Area or keyword" aria-label="Search reports or areas" /></label><label className="safety-category"><span className="safety-control-label">Category</span><select value={category} onChange={event => setCategory(event.target.value as "all" | IncidentCategory)}>{filters.map(item => <option key={item} value={item}>{item === "all" ? "All categories" : categoryNames[item]}</option>)}</select></label></div>}
          {locationMessage && <p className="safety-location-message" role="status">{locationMessage} {nearbyOnly && <button onClick={() => { setNearbyOnly(false); setLocationMessage("") }}>Show all</button>}</p>}
          {error ? <div className="safety-empty" role="alert"><h3>Reports are unavailable</h3><p>{error}</p></div> : loading ? <div className="safety-empty"><p>Loading recent reports…</p></div> : filtered.length === 0 ? <div className="safety-empty"><h3>{incidents.length === 0 ? "No recent reports" : "No matching reports"}</h3><p>{incidents.length === 0 ? "No public reports have been shared in the last 24 hours. New reports will appear here." : "Try a different search or category, or show all areas."}</p>{incidents.length > 0 && <button type="button" className="safety-clear-button" onClick={() => { setSearch(""); setCategory("all"); setNearbyOnly(false); setLocationMessage("") }}>Clear filters</button>}</div> : <div className="safety-list">{filtered.map(incident => <button type="button" key={incident.id} className="safety-incident" onClick={() => selectIncident(incident.id)}><div className="safety-incident-top"><span className={`safety-severity severity-${incident.severity.toLowerCase()}`}>{incident.severity}</span><span>{timeLabel(incident.reportedAt)}</span></div><h3>{incident.title}</h3><p>{incident.summary}</p><div className="safety-incident-meta"><span>{categoryNames[incident.category]}</span><span>·</span><span>{incident.neighborhood}</span>{incident.locationPending && <span className="safety-private-location">Location withheld</span>}</div></button>)}</div>}
          <p className="safety-feed-note">Shows up to 150 public reports from the last 24 hours. This is not a complete history; some locations are hidden for privacy.</p>
        </div>
      </section>
    </main>
    <footer className="safety-footer"><span>PulseTrackr by PulseTrack</span><span>SOS, trusted contacts, and escorted walks are available in the iPhone app</span></footer>
    {showReport && <ReportDialog onClose={() => { setShowReport(false); if (location.search) navigate(location.pathname, { replace: true }) }} onCreated={id => navigate(`/incident/${encodeURIComponent(id)}`)} />}
  </div>
}
