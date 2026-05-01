import { useQuery } from "@tanstack/react-query"
import { fetchLatestSentiments } from "../lib/pulseData"

export function useSentiment() {
  return useQuery({
    queryKey: ["sentiment", "latest"],
    queryFn: () => fetchLatestSentiments(12),
    refetchInterval: 600000,
    staleTime: 300000,
    retry: 2,
    refetchOnWindowFocus: false,
  })
}
