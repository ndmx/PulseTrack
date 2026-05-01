import { collection, getDocs, limit, orderBy, query, Timestamp, where } from "firebase/firestore"
import { db } from "./firebase"

const NATIONAL_STATE = "National"
const MONTHLY_ROLLUP_COLLECTION = "approval_trends_monthly"

type FirestoreTimestamp = {
  toDate: () => Date
}

function toIsoString(value: any): string | undefined {
  if (!value) return undefined
  if (typeof value.toDate === "function") {
    return value.toDate().toISOString()
  }
  if (value instanceof Date) {
    return value.toISOString()
  }
  if (typeof value === "string") {
    return value
  }
  return undefined
}

export type ApprovalRecord = {
  id: string
  candidate: string
  rating_score: number
  change_delta?: number
  state?: string
  timestamp?: string
  bucket_minute?: string
  input_count?: number
}

export type SentimentRecord = {
  id: string
  candidate: string
  positive: number
  negative: number
  neutral: number
  timestamp?: string
  headlines?: string
  bucket_minute?: string
}

export type MonthlyTrendRecord = {
  id: string
  candidate: string
  bucket_month?: string
  avg_rating: number
  sample_count?: number
  updated_at?: string
}

function buildTimestampFilter(days: number | undefined) {
  if (!days) return undefined
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  return Timestamp.fromDate(cutoff)
}

async function queryApprovalSnapshots(days: number | undefined, restrictToNational: boolean): Promise<ApprovalRecord[]> {
  const limitCount = Math.max(150, (days ?? 30) * 4)
  const cutoffDate = days ? (() => {
    const d = new Date()
    d.setDate(d.getDate() - days)
    return d
  })() : undefined
  const timestampFilter = buildTimestampFilter(days)
  const baseConstraints: any[] = []
  if (timestampFilter) baseConstraints.push(where("timestamp", ">=", timestampFilter))
  baseConstraints.push(orderBy("timestamp", "desc"), limit(limitCount))

  let snapshot
  try {
    snapshot = await getDocs(query(collection(db, "approval_ratings"), ...baseConstraints))
  } catch (err) {
    try {
      snapshot = await getDocs(
        query(collection(db, "approval_ratings"), orderBy("bucket_minute", "desc"), limit(limitCount))
      )
    } catch {
      snapshot = await getDocs(query(collection(db, "approval_ratings"), limit(limitCount)))
    }
  }

  let records = snapshot.docs.map(doc => {
    const data = doc.data() as Record<string, any>
    return {
      id: doc.id,
      candidate: data.candidate,
      rating_score: Number(data.rating_score ?? data.avg_rating ?? 0),
      change_delta: Number(data.change_delta ?? data.delta ?? 0),
      state: data.state,
      timestamp: toIsoString(data.timestamp as FirestoreTimestamp),
      bucket_minute: data.bucket_minute,
      input_count: data.input_count,
    }
  })

  const parseDateValue = (value?: string) => {
    if (!value) return undefined
    const parsed = Date.parse(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }

  if (cutoffDate) {
    records = records.filter((rec) => {
      const parsed =
        parseDateValue(rec.timestamp) ??
        parseDateValue(rec.bucket_minute) ??
        undefined
      if (typeof parsed === "number") {
        return parsed >= cutoffDate.getTime()
      }
      return true
    })
  }

  records.sort((a, b) => {
    const timeA =
      parseDateValue(a.timestamp) ??
      parseDateValue(a.bucket_minute) ??
      0
    const timeB =
      parseDateValue(b.timestamp) ??
      parseDateValue(b.bucket_minute) ??
      0
    return timeB - timeA
  })

  if (restrictToNational) {
    records = records.filter((rec) => (rec.state || "").toLowerCase() === NATIONAL_STATE.toLowerCase())
  }

  return records.slice(0, limitCount)
}

export async function fetchApprovalSnapshots(days = 30): Promise<ApprovalRecord[]> {
  const national = await queryApprovalSnapshots(days, true)
  if (national.length > 0) {
    return national
  }
  // Fall back to latest approvals regardless of state if no national aggregate exists.
  return queryApprovalSnapshots(days, false)
}

export async function fetchApprovalTrend(range: "all" | number = "all"): Promise<ApprovalRecord[]> {
  if (range === "all") {
    return fetchApprovalSnapshots(undefined)
  }
  return fetchApprovalSnapshots(range)
}

export async function fetchLatestSentiments(maxDocs = 12): Promise<SentimentRecord[]> {
  const sentiments = await getDocs(
    query(
      collection(db, "sentiment_breakdown"),
      orderBy("timestamp", "desc"),
      limit(maxDocs)
    )
  )

  return sentiments.docs.map(doc => {
    const data = doc.data() as Record<string, any>
    return {
      id: doc.id,
      candidate: data.candidate,
      positive: data.positive,
      negative: data.negative,
      neutral: data.neutral,
      headlines: data.headlines,
      bucket_minute: data.bucket_minute,
      timestamp: toIsoString(data.timestamp as FirestoreTimestamp),
    }
  })
}

async function fetchMonthlyApprovalRollups(limitMonths?: number): Promise<MonthlyTrendRecord[]> {
  const maxDocs = limitMonths ? Math.max(3, limitMonths * 3) : 240
  const snapshot = await getDocs(
    query(
      collection(db, MONTHLY_ROLLUP_COLLECTION),
      orderBy("bucket_month", "asc"),
      limit(maxDocs)
    )
  )

  return snapshot.docs.map(doc => {
    const data = doc.data() as Record<string, any>
    return {
      id: doc.id,
      candidate: data.candidate || "Unknown",
      bucket_month: data.bucket_month,
      avg_rating: Number(data.avg_rating ?? data.rating_score ?? 0),
      sample_count: Number(data.sample_count ?? data.input_count ?? 0),
      updated_at: toIsoString(data.updated_at as FirestoreTimestamp),
    }
  }).filter((row) => Boolean(row.bucket_month))
}

export async function fetchMonthlyApprovalTrend(limitMonths?: number): Promise<MonthlyTrendRecord[]> {
  const rollups = await fetchMonthlyApprovalRollups(limitMonths).catch(() => [])
  if (rollups.length > 0) {
    return rollups
  }

  const approvals = await queryApprovalSnapshots(limitMonths ? limitMonths * 31 : undefined, false)
  const bucket: Record<string, { candidate: string; bucket_month: string; sum: number; count: number; updated_at?: string }> = {}
  for (const record of approvals) {
    const ts = record.timestamp ? new Date(record.timestamp) : undefined
    const bucketMonth = ts ? `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, "0")}` : record.bucket_minute?.slice(0, 7)
    if (!bucketMonth) continue
    const key = `${record.candidate || "Unknown"}::${bucketMonth}`
    if (!bucket[key]) {
      bucket[key] = { candidate: record.candidate || "Unknown", bucket_month: bucketMonth, sum: 0, count: 0 }
    }
    bucket[key].sum += Number(record.rating_score || 0)
    bucket[key].count += 1
    if (record.timestamp) {
      bucket[key].updated_at = record.timestamp
    }
  }

  return Object.entries(bucket)
    .map(([id, row]) => ({
      id,
      candidate: row.candidate,
      bucket_month: row.bucket_month,
      avg_rating: row.count > 0 ? row.sum / row.count : 0,
      sample_count: row.count,
      updated_at: row.updated_at,
    }))
    .sort((a, b) => a.bucket_month.localeCompare(b.bucket_month))
}
