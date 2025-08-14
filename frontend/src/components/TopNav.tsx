import React from "react"
import { Link, useLocation } from "react-router-dom"

function isActivePath(currentPath: string, target: string): boolean {
  if (target === "/pulsetrack") {
    return currentPath === "/" || currentPath.startsWith("/pulsetrack")
  }
  return currentPath.startsWith(target)
}

export default function TopNav() {
  const location = useLocation()
  const path = location.pathname

  const baseStyle: React.CSSProperties = {
    padding: "8px 14px",
    borderRadius: 9999,
    border: "1px solid #CED4DA",
    textDecoration: "none",
    fontWeight: 600,
  }

  const activeStyle: React.CSSProperties = {
    ...baseStyle,
    background: "#0D6EFD",
    color: "#fff",
    borderColor: "#0D6EFD",
  }

  const inactiveStyle: React.CSSProperties = {
    ...baseStyle,
    background: "#F8F9FA",
    color: "#212529",
  }

  return (
    <nav style={{ display: "flex", gap: 12, marginBottom: 16 }}>
      <Link to="/pulsetrack" style={isActivePath(path, "/pulsetrack") ? activeStyle : inactiveStyle}>PulseTrack</Link>
      <Link to="/snapstats" style={isActivePath(path, "/snapstats") ? activeStyle : inactiveStyle}>Snapstats</Link>
    </nav>
  )
}


