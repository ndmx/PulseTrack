import { useQuery } from "@tanstack/react-query"
import { fetchMonthlyApprovalTrend } from "../lib/pulseData"

export function useTrendsAllTime() {
  return useQuery({
    queryKey: ["trends", "all"],
    queryFn: () => fetchMonthlyApprovalTrend(),
    refetchInterval: 600000,
    staleTime: 300000,
    retry: 2,
    refetchOnWindowFocus: false,
  })
}
