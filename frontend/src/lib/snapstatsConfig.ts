type EnvValue = string | boolean | undefined

function cleanBasePath(value: EnvValue): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  return trimmed.replace(/\/+$/, "")
}

const base = cleanBasePath(import.meta.env.VITE_SNAPSTATS_BASE_URL) || "/snapstats"

function envOrDefault(envValue: EnvValue, fallback: string): string {
  if (typeof envValue === "string" && envValue.trim().length > 0) {
    return envValue.trim()
  }
  return fallback
}

export const SNAPSTATS_URLS = {
  base,
  geojson: envOrDefault(import.meta.env.VITE_SNAPSTATS_GEOJSON_URL, `${base}/nigeria_states.geojson`),
  demographics: `${base}/state_demographics.json`,
  derived: {
    demographics: `${base}/derived/demographics.json`,
    zoneStats: envOrDefault(import.meta.env.VITE_SNAPSTATS_ZONE_STATS_URL, `${base}/derived/zone_stats.json`),
    tribeStats: envOrDefault(import.meta.env.VITE_SNAPSTATS_TRIBE_STATS_URL, `${base}/derived/tribe_stats.json`),
    partyStats: envOrDefault(import.meta.env.VITE_SNAPSTATS_PARTY_STATS_URL, `${base}/derived/party_stats.json`),
  },
}

