import { useQuery } from "@tanstack/react-query"
import { supabase } from "../lib/supabase"
import dayjs from "dayjs"

export function useApprovalData() {
  return useQuery({
    queryKey: ["approval", "30d"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("approval_ratings")
        .select("timestamp,candidate,rating_score,change_delta,state")
        .gte("timestamp", dayjs().subtract(30, "day").toISOString())
        .or("state.eq.National,state.is.null")
        .order("timestamp", { ascending: true })
      if (error) throw error
      return data || []
    },
    refetchInterval: 600000,
    staleTime: 300000,
    retry: 2,
    refetchOnWindowFocus: false,
  })
}
