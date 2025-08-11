import { useQuery } from "@tanstack/react-query"
import { supabase } from "../lib/supabase"

export function useTrendsAllTime() {
  return useQuery({
    queryKey: ["trends", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("approval_ratings")
        .select("timestamp,candidate,rating_score,state")
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
