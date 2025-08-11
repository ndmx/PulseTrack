import React from "react"
import { useSentiment } from "../hooks/useSentiment"

export const Headlines: React.FC = () => {
  const { data, isLoading, isError } = useSentiment()
  if (isLoading) return <p>Loading...</p>
  if (isError || !data?.length) return <p>No sentiment data available.</p>
  const firstByCand = new Map<string, any>()
  for (const row of data) if (!firstByCand.has(row.candidate)) firstByCand.set(row.candidate, row)
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
      {[...firstByCand.entries()].map(([cand, row]) => (
        <div key={cand} style={{ border: "1px solid #E9ECEF", borderRadius: 12, padding: 12, background: "#fff" }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>{cand}</div>
          <div style={{ whiteSpace: "pre-wrap", color: "#333" }}>
            {row.headlines || "No headlines."}
          </div>
        </div>
      ))}
    </div>
  )
}
