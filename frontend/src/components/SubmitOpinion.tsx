import React, { useMemo, useState } from "react"
import { db } from "../lib/firebase"
import { collection, addDoc, serverTimestamp } from "firebase/firestore"
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
        timestamp: serverTimestamp(),
      }
      
      await addDoc(collection(db, "raw_inputs"), payload)
      setMsg("Thank you! Your opinion has been recorded.")
      setOpinion("")
    } catch (err) {
      console.error(err)
      setMsg("Unexpected error. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ 
      border: "1px solid #E5E7EB", 
      borderRadius: 16, 
      padding: "24px", 
      background: "#FFFFFF",
      boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)"
    }}>
      <div style={{ marginBottom: "20px" }}>
        <h3 style={{ margin: "0 0 8px 0", fontSize: "18px", fontWeight: 600, color: "#111827" }}>
          Share Your Opinion
        </h3>
        <p style={{ margin: 0, fontSize: "14px", color: "#6B7280", lineHeight: 1.5 }}>
          Your voice matters. Share your thoughts on candidates and help us track public sentiment across Nigeria.
        </p>
      </div>

      <form onSubmit={onSubmit}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "16px" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ fontSize: "13px", fontWeight: 500, color: "#374151" }}>
              Candidate
            </span>
            <select 
              value={candidate} 
              onChange={(e) => setCandidate(e.target.value)}
              style={{
                padding: "10px 12px",
                fontSize: "14px",
                border: "1px solid #D1D5DB",
                borderRadius: "8px",
                background: "#F9FAFB",
                color: "#111827",
                cursor: "pointer",
                transition: "all 0.2s ease",
                outline: "none"
              }}
              onFocus={(e) => e.target.style.borderColor = "#008753"}
              onBlur={(e) => e.target.style.borderColor = "#D1D5DB"}
            >
              <option value="Tinubu">Bola Tinubu</option>
              <option value="Atiku">Atiku Abubakar</option>
              <option value="Obi">Peter Obi</option>
            </select>
          </label>
          
          <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ fontSize: "13px", fontWeight: 500, color: "#374151" }}>
              Your State
            </span>
            <select 
              value={location} 
              onChange={(e) => setLocation(e.target.value)}
              style={{
                padding: "10px 12px",
                fontSize: "14px",
                border: "1px solid #D1D5DB",
                borderRadius: "8px",
                background: "#F9FAFB",
                color: location ? "#111827" : "#9CA3AF",
                cursor: "pointer",
                transition: "all 0.2s ease",
                outline: "none"
              }}
              onFocus={(e) => e.target.style.borderColor = "#008753"}
              onBlur={(e) => e.target.style.borderColor = "#D1D5DB"}
            >
              <option value="">Select your state</option>
              {states.map((s) => (<option key={s} value={s}>{s}</option>))}
            </select>
          </label>
        </div>

        <label style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "16px" }}>
          <span style={{ fontSize: "13px", fontWeight: 500, color: "#374151" }}>
            Your Opinion
          </span>
          <textarea 
            value={opinion} 
            onChange={(e) => setOpinion(e.target.value)} 
            rows={4} 
            placeholder="Share your thoughts about this candidate's policies, leadership, or vision for Nigeria..."
            style={{
              padding: "12px",
              fontSize: "14px",
              border: "1px solid #D1D5DB",
              borderRadius: "8px",
              background: "#F9FAFB",
              color: "#111827",
              fontFamily: "inherit",
              resize: "vertical",
              transition: "all 0.2s ease",
              outline: "none",
              lineHeight: 1.5
            }}
            onFocus={(e) => e.target.style.borderColor = "#008753"}
            onBlur={(e) => e.target.style.borderColor = "#D1D5DB"}
          />
          <span style={{ fontSize: "12px", color: "#9CA3AF", marginTop: "2px" }}>
            {opinion.length}/500 characters
          </span>
        </label>

        <button 
          type="submit" 
          disabled={submitting}
          style={{ 
            padding: "12px 24px",
            fontSize: "14px",
            fontWeight: 600,
            borderRadius: "8px",
            border: "none",
            background: submitting ? "#9CA3AF" : "#008753",
            color: "#FFFFFF",
            cursor: submitting ? "not-allowed" : "pointer",
            transition: "all 0.2s ease",
            boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
            width: "100%",
            maxWidth: "200px"
          }}
          onMouseEnter={(e) => { if (!submitting) e.currentTarget.style.background = "#006B42" }}
          onMouseLeave={(e) => { if (!submitting) e.currentTarget.style.background = "#008753" }}
        >
          {submitting ? "Submitting..." : "Submit Opinion"}
        </button>

        {msg && (
          <div style={{ 
            marginTop: "16px",
            padding: "12px 16px",
            borderRadius: "8px",
            background: msg.includes("Thank you") ? "#ECFDF5" : "#FEF2F2",
            border: `1px solid ${msg.includes("Thank you") ? "#A7F3D0" : "#FECACA"}`,
            color: msg.includes("Thank you") ? "#065F46" : "#991B1B",
            fontSize: "14px"
          }}>
            {msg}
          </div>
        )}

        {demo.isError && (
          <div style={{ 
            marginTop: "12px",
            padding: "10px 14px",
            borderRadius: "6px",
            background: "#FEF3C7",
            border: "1px solid #FDE68A",
            color: "#92400E",
            fontSize: "13px"
          }}>
            Could not load states list. Please refresh the page.
          </div>
        )}
      </form>

      <details style={{ marginTop: "16px", fontSize: "13px", color: "#6B7280" }}>
        <summary style={{ cursor: "pointer", fontWeight: 500, padding: "8px 0" }}>
          Having trouble submitting?
        </summary>
        <div style={{ 
          padding: "12px 16px", 
          marginTop: "8px", 
          background: "#F9FAFB", 
          borderRadius: "8px",
          border: "1px solid #E5E7EB",
          lineHeight: 1.6
        }}>
          <p style={{ margin: "0 0 8px 0" }}>If your submission fails:</p>
          <ul style={{ margin: 0, paddingLeft: "20px" }}>
            <li>Check your internet connection</li>
            <li>Try again in a few minutes</li>
            <li>Reload the page and resubmit</li>
            <li>Ensure you've selected a state and entered your opinion</li>
          </ul>
        </div>
      </details>
    </div>
  )
}
