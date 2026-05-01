import { useQuery } from "@tanstack/react-query"
import { fetchApprovalSnapshots } from "../lib/pulseData"

export function useApprovalData() {
  return useQuery({
    queryKey: ["approval", "30d"],
    queryFn: () => fetchApprovalSnapshots(30),
    refetchInterval: 600000,
    staleTime: 300000,
    retry: 2,
    refetchOnWindowFocus: false,
  })
}
