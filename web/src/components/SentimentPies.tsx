import React from "react"
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { useSentiment } from "../hooks/useSentiment"

const COLORS = { Positive: "#2ECC71", Negative: "#E74C3C", Neutral: "#95A5A6" } as const

export const SentimentPies: React.FC = () => {
  const { data, isLoading, isError } = useSentiment()
  if (isLoading) return <p>Loading...</p>
  if (isError || !data) return <p>Error loading sentiment</p>
  const latestPerCand: Record<string, any> = {}
  for (const row of data) if (!latestPerCand[row.candidate]) latestPerCand[row.candidate] = row
  const cands = Object.keys(latestPerCand)
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
      {cands.map((cand) => {
        const r = latestPerCand[cand]
        const series = [
          { name: "Positive", value: r.positive },
          { name: "Negative", value: r.negative },
          { name: "Neutral", value: r.neutral },
        ]
        return (
          <div key={cand} style={{ height: 320, border: "1px solid #E9ECEF", borderRadius: 12, padding: 12, background: "#fff" }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>{cand} Sentiment</div>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={series} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90}>
                  {series.map((s) => (
                    <Cell key={s.name} fill={COLORS[s.name as keyof typeof COLORS]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )
      })}
    </div>
  )
}
