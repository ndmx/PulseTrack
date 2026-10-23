import { Link, useLocation } from "react-router-dom"

export default function TopNav() {
  const path = useLocation().pathname
  const active = path.startsWith("/snapstats") ? "snapstats" : path.startsWith("/insights") || path.startsWith("/pulsetrack") ? "insights" : "reports"

  return <nav className="section-nav" aria-label="Main navigation">
    <Link className="section-brand" to="/">PulseTrack</Link>
    <Link className={active === "reports" ? "current" : ""} aria-current={active === "reports" ? "page" : undefined} to="/">Reports</Link>
    <Link className={active === "insights" ? "current" : ""} aria-current={active === "insights" ? "page" : undefined} to="/insights">Civic insights</Link>
    <Link className={active === "snapstats" ? "current" : ""} aria-current={active === "snapstats" ? "page" : undefined} to="/snapstats">Snapstats</Link>
  </nav>
}
