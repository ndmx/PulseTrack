import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check"
import { getAuth, signInAnonymously } from "firebase/auth"
import { collection, doc, getDoc, limit, onSnapshot, orderBy, query, Timestamp, where, type DocumentData } from "firebase/firestore"
import { getFunctions, httpsCallable } from "firebase/functions"
import { app, db } from "./firebase"

export type IncidentCategory = "security" | "traffic" | "fire" | "medical" | "weather" | "utilities" | "structure" | "community"
export type IncidentSeverity = "Low" | "Medium" | "High" | "Urgent"

export type SafetyIncident = {
  id: string
  title: string
  summary: string
  category: IncidentCategory
  subtype: string
  severity: IncidentSeverity
  status: string
  neighborhood: string
  latitude: number | null
  longitude: number | null
  reportedAt: Date | null
  expiresAt: Date | null
  confirmations: number
  disputes: number
  unsafeReports: number
  blockedReports: number
  officialUpdates: number
  locationPending: boolean
}

const categories: IncidentCategory[] = ["security", "traffic", "fire", "medical", "weather", "utilities", "structure", "community"]
export const categoryNames: Record<IncidentCategory, string> = {
  security: "Security", traffic: "Traffic", fire: "Fire", medical: "Medical",
  weather: "Weather", utilities: "Utilities", structure: "Structures", community: "Community",
}
export const defaultSubtype: Record<IncidentCategory, string> = {
  security: "suspicious_activity", traffic: "roadblock", fire: "building_fire",
  medical: "medical_emergency", weather: "heavy_rain", utilities: "power_outage",
  structure: "unsafe_building", community: "local_warning",
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return value
  if (value && typeof (value as Timestamp).toDate === "function") return (value as Timestamp).toDate()
  if (typeof value === "string") {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  return null
}

function boundedText(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.slice(0, 2000) : fallback
}

export function incidentFromData(id: string, data: DocumentData): SafetyIncident {
  const category = categories.includes(data.category) ? data.category as IncidentCategory : "community"
  const latitude = typeof data.latitude === "number" && Math.abs(data.latitude) <= 90 ? data.latitude : null
  const longitude = typeof data.longitude === "number" && Math.abs(data.longitude) <= 180 ? data.longitude : null
  return {
    id,
    title: boundedText(data.title, "Community report"),
    summary: boundedText(data.summary),
    category,
    subtype: boundedText(data.subtype),
    severity: ["Low", "Medium", "High", "Urgent"].includes(data.severity) ? data.severity : "Medium",
    status: boundedText(data.status, "Active"),
    neighborhood: boundedText(data.neighborhood, "Nearby area"),
    latitude,
    longitude,
    reportedAt: toDate(data.reported_at),
    expiresAt: toDate(data.deleteAfter),
    confirmations: Math.max(0, Number(data.confirmations) || 0),
    disputes: Math.max(0, Number(data.disputes) || 0),
    unsafeReports: Math.max(0, Number(data.unsafe_reports) || 0),
    blockedReports: Math.max(0, Number(data.blocked_reports) || 0),
    officialUpdates: Math.max(0, Number(data.official_updates) || 0),
    locationPending: data.location_reveal_status === "pending_k_anonymity" || latitude === null || longitude === null,
  }
}

// Mirror the iPhone feed's public-data scopes. These use only fields already
// present in safety_incidents_public; no reporter identity is needed.
const alwaysHighRiskSubtypes = new Set([
  "armed_robbery", "kidnapping", "gunshots", "carjacking", "communal_clash",
  "building_fire", "market_fire", "gas_leak", "explosion", "pipeline_fire",
  "medical_emergency", "suspected_outbreak", "flooding", "building_collapse",
  "bridge_collapse", "road_collapse", "fallen_power_line", "missing_person",
])

export type FeedScope = "all" | "priority" | "new" | "verified"

export function matchesFeedScope(incident: SafetyIncident, scope: FeedScope): boolean {
  if (scope === "all") return true
  if (scope === "priority") return incident.severity === "High" || incident.severity === "Urgent" || incident.unsafeReports > 0 || alwaysHighRiskSubtypes.has(incident.subtype)
  const verified = incident.officialUpdates > 0 || (incident.confirmations >= 8 && incident.disputes < incident.confirmations)
  if (scope === "verified") return verified
  const unconfirmed = !verified && incident.confirmations < 2 && incident.unsafeReports === 0 && incident.blockedReports === 0
  return unconfirmed || Boolean(incident.reportedAt && Date.now() - incident.reportedAt.getTime() < 20 * 60_000)
}

export function isCurrent(incident: SafetyIncident): boolean {
  return incident.status !== "Resolved" && (!incident.expiresAt || incident.expiresAt.getTime() > Date.now())
}

const LIVE_WINDOW_MS = 24 * 60 * 60 * 1000

export function isRecent(incident: SafetyIncident): boolean {
  if (!isCurrent(incident) || !incident.reportedAt) return false
  const age = Date.now() - incident.reportedAt.getTime()
  return age >= 0 && age <= LIVE_WINDOW_MS
}

/** A bounded live overview. Nearby filtering happens in the browser for this first web release. */
export function subscribeIncidents(onChange: (incidents: SafetyIncident[]) => void, onError: (error: Error) => void) {
  const since = Timestamp.fromMillis(Date.now() - LIVE_WINDOW_MS)
  const latest = query(collection(db, "safety_incidents_public"), where("reported_at", ">=", since), orderBy("reported_at", "desc"), limit(150))
  let cached: SafetyIncident[] = []
  const publish = () => onChange(cached.filter(isRecent))
  const unsubscribe = onSnapshot(latest, snapshot => {
    cached = snapshot.docs.map(item => incidentFromData(item.id, item.data()))
    publish()
  }, onError)
  const clock = window.setInterval(publish, 60_000)
  return () => { window.clearInterval(clock); unsubscribe() }
}

export async function getIncident(id: string): Promise<SafetyIncident | null> {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) return null
  const snapshot = await getDoc(doc(db, "safety_incidents_public", id))
  if (!snapshot.exists()) return null
  const incident = incidentFromData(snapshot.id, snapshot.data())
  return isCurrent(incident) ? incident : null
}

const appCheckSiteKey = import.meta.env.VITE_FIREBASE_APP_CHECK_SITE_KEY?.trim()
export const reportingAvailable = import.meta.env.VITE_PULSETRACKR_REPORTING_ENABLED === "true" && Boolean(appCheckSiteKey)
if (appCheckSiteKey) {
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
    isTokenAutoRefreshEnabled: true,
  })
}

export type ReportDraft = {
  title: string
  summary: string
  category: IncidentCategory
  severity: IncidentSeverity
  neighborhood: string
  latitude: number
  longitude: number
}

export async function submitReport(draft: ReportDraft): Promise<string> {
  if (!reportingAvailable) throw new Error("Browser reporting is not enabled yet.")
  const auth = getAuth(app)
  if (!auth.currentUser) await signInAnonymously(auth)
  const submit = httpsCallable(getFunctions(app, "us-central1"), "submit_incident")
  const result = await submit({
    ...draft,
    subtype: defaultSubtype[draft.category],
    status: "Active",
    use_approximate_location: true,
    client_ref: crypto.randomUUID(),
    source: "web",
    evidence: [],
  })
  const id = (result.data as { incident_id?: unknown })?.incident_id
  if (typeof id !== "string" || !id) throw new Error("The report was sent, but no incident ID was returned.")
  return id
}
