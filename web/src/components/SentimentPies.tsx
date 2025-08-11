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
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12 }}>
      {cands.map((cand) => {
        const r = latestPerCand[cand]
        const series = [
          { name: "Positive", value: r.positive },
          { name: "Negative", value: r.negative },
          { name: "Neutral", value: r.neutral },
        ]
        return (
          <div key={cand} style={{ height: 320, border: "1px solid #E9ECEF", borderRadius: 12, padding: 12, background: "#fff", overflow: "hidden" }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>{cand} Sentiment</div>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart margin={{ top: 0, right: 8, bottom: 40, left: 8 }}>
                <Pie data={series} dataKey="value" nameKey="name" innerRadius={58} outerRadius={86}>
                  {series.map((s) => (
                    <Cell key={s.name} fill={COLORS[s.name as keyof typeof COLORS]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={28} wrapperStyle={{ overflow: 'hidden' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )
      })}
    </div>
  )
}
