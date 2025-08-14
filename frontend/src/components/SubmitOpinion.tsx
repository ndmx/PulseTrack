import React, { useMemo, useState } from "react"
import { supabase } from "../lib/supabase"
import { useDemographics } from "../hooks/useDemographics"

export const SubmitOpinion: React.FC = () => {
  const demo = useDemographics()
  const [candidate, setCandidate] = useState("Tinubu")
  const [location, setLocation] = useState("")
  const [opinion, setOpinion] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const states: string[] = useMemo(() => {
    if (!demo.data) return []
    const set = new Set<string>()
    for (const r of demo.data) if (r?.state) set.add(String(r.state))
    return Array.from(set).sort()
  }, [demo.data])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    if (!opinion.trim() || !location) {
      setMsg("Please select a state and enter your opinion.")
      return
    }
    try {
      setSubmitting(true)
      const payload = {
        source: "user_form",
        content: opinion.trim(),
        user_id: crypto.randomUUID(),
        location,
        candidate,
      }
      const { error } = await supabase.from("raw_inputs").insert([payload])
      if (error) {
        console.error(error)
        setMsg("Submit failed (RLS may block inserts). Please try again later.")
      } else {
        setMsg("Thank you! Your opinion has been recorded.")
        setOpinion("")
      }
    } catch (err) {
      console.error(err)
      setMsg("Unexpected error. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ border: "1px solid #E9ECEF", borderRadius: 12, padding: 16, background: "#fff" }}>
      <form onSubmit={onSubmit}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
          <label style={{ display: "flex", flexDirection: "column", minWidth: 180 }}>
            <span>Candidate</span>
            <select value={candidate} onChange={(e) => setCandidate(e.target.value)}>
              <option value="Tinubu">Tinubu</option>
              <option value="Atiku">Atiku</option>
              <option value="Obi">Obi</option>
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", minWidth: 220 }}>
            <span>Your State</span>
            <select value={location} onChange={(e) => setLocation(e.target.value)}>
              <option value="">Select state</option>
              {states.map((s) => (<option key={s} value={s}>{s}</option>))}
            </select>
          </label>
        </div>
        <label style={{ display: "flex", flexDirection: "column", marginBottom: 12 }}>
          <span>Your Opinion</span>
          <textarea value={opinion} onChange={(e) => setOpinion(e.target.value)} rows={4} placeholder="Share your opinion..." />
        </label>
        <button type="submit" disabled={submitting} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #E9ECEF", background: "#008753", color: "#fff", cursor: submitting ? "not-allowed" : "pointer" }}>
          {submitting ? "Submitting..." : "Submit"}
        </button>
        {msg && <p style={{ marginTop: 8 }}>{msg}</p>}
        {demo.isError && <p style={{ marginTop: 8 }}>Note: Could not load states list.</p>}
      </form>
      <details style={{ marginTop: 10 }}>
        <summary>Trouble submitting?</summary>
        <p>If your submission fails, please try again in a few minutes or reload this page. If the issue persists, it may be a temporary service restriction.</p>
      </details>
    </div>
  )
}
