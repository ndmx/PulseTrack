import { Link, useLocation } from "react-router-dom"
import { reportingAvailable } from "../lib/safety"

export default function SafetyHeader({ onReport }: { onReport?: () => void }) {
  const { pathname } = useLocation()
  const section = pathname === "/feed" ? "feed" : pathname.startsWith("/incident/") || pathname.startsWith("/i/") ? "incident" : "map"

  return <header className="safety-header">
    <Link to="/" className="safety-brand" aria-label="PulseTrackr map"><strong>PulseTrackr</strong><span>by PulseTrack</span></Link>
    <nav aria-label="Safety navigation">
      <Link className={section === "map" ? "current" : ""} aria-current={section === "map" ? "page" : undefined} to="/">Map</Link>
      <Link className={section === "feed" ? "current" : ""} aria-current={section === "feed" ? "page" : undefined} to="/feed">Feed</Link>
      {reportingAvailable && (onReport
        ? <button type="button" className="safety-nav-report" onClick={onReport}>Report</button>
        : <Link className="safety-nav-report" to="/?report=1">Report</Link>)}
    </nav>
  </header>
}
