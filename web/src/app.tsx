import React from "react"
import { useApprovalData } from "./hooks/useApprovalData"
import { useSentiment } from "./hooks/useSentiment"
import { useTrendsAllTime } from "./hooks/useTrendsAllTime"
import { useDemographics } from "./hooks/useDemographics"
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from "recharts"

export default function App() {
  const approval = useApprovalData()
  const sentiment = useSentiment()
  const trends = useTrendsAllTime()
  const demo = useDemographics()

  return (
    <div style={{ padding: 16, fontFamily: "-apple-system, system-ui, Arial" }}>
      <h1>🇳🇬 PulseTrack</h1>
      <p>React UI (Supabase + React Query). Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your host.</p>

      <section>
        <h2>Current Approval (30 days, National)</h2>
        {approval.isLoading ? <p>Loading...</p> : approval.isError ? <p>Error</p> : (
          <pre style={{ background: "#f7f7f9", padding: 12, borderRadius: 8, overflow: "auto" }}>
            {JSON.stringify(approval.data?.slice(-6), null, 2)}
          </pre>
        )}
      </section>

      <section>
        <h2>Sentiment Breakdown (Latest)</h2>
        {sentiment.isLoading ? <p>Loading...</p> : sentiment.isError ? <p>Error</p> : (
          <pre style={{ background: "#f7f7f9", padding: 12, borderRadius: 8, overflow: "auto" }}>
            {JSON.stringify(sentiment.data?.slice(0, 6), null, 2)}
          </pre>
        )}
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
