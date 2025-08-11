import React from "react"
import { useApprovalData } from "../hooks/useApprovalData"

export const ApprovalCards: React.FC = () => {
  const { data, isLoading, isError } = useApprovalData()
  if (isLoading) return <p>Loading...</p>
  if (isError || !data) return <p>Error loading approvals</p>
  const latestByCand = new Map<string, any>()
  for (const row of data) latestByCand.set(row.candidate, row)
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
      {[...latestByCand.entries()].map(([cand, row]) => (
        <div key={cand} style={{ border: "1px solid #E9ECEF", borderRadius: 12, padding: 16, background: "#fff" }}>
          <div style={{ fontSize: 14, color: "#666" }}>{cand}</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{row.rating_score?.toFixed?.(1) ?? row.rating_score}%</div>
          <div style={{ fontSize: 12, color: row.change_delta >= 0 ? "#2ECC71" : "#E74C3C" }}>
            {row.change_delta >= 0 ? "+" : ""}{row.change_delta}
          </div>
        </div>
      ))}
    </div>
  )
}
