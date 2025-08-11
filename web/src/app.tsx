import React from "react"
import { ApprovalCards } from "./components/ApprovalCards"
import { SentimentPies } from "./components/SentimentPies"
import { useTrendsAllTime } from "./hooks/useTrendsAllTime"
import { useDemographics } from "./hooks/useDemographics"
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from "recharts"

export default function App() {
  const trends = useTrendsAllTime()
  const demo = useDemographics()

  return (
    <div style={{ padding: 16, fontFamily: "-apple-system, system-ui, Arial" }}>
      <h1>🇳🇬 PulseTrack</h1>
      

      <section>
        <h2>Current Approval (30 days, National)</h2>
        <ApprovalCards />
      </section>

      <section>
        <h2>Sentiment Breakdown (Latest)</h2>
        <SentimentPies />
      </section>

      <section>
        <h2>Key Headlines Affecting Trends</h2>
        <Headlines />
      </section>

      <section>
        <h2>Approval Trends (All Time)</h2>
        <div style={{ height: 320 }}>
          {trends.isLoading ? <p>Loading...</p> : trends.isError ? <p>Error</p> : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trends.data}>
                <XAxis dataKey="timestamp" hide />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="rating_score" stroke="#008753" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <section>
        <h2>Registered Voters by State</h2>
        <div style={{ height: 400 }}>
          {demo.isLoading ? <p>Loading...</p> : demo.isError ? <p>Error</p> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={demo.data} layout="vertical" margin={{ left: 40, right: 20, top: 10, bottom: 10 }}>
                <XAxis type="number" />
                <YAxis dataKey="state" type="category" width={100} />
                <Tooltip />
                <Bar dataKey="registered_voters" fill="#007BFF" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>
    </div>
  )
}
