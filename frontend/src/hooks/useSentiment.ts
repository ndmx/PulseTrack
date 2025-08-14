import { useQuery } from "@tanstack/react-query"
import { supabase } from "../lib/supabase"

export function useSentiment() {
  return useQuery({
    queryKey: ["sentiment", "latest"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sentiment_breakdown")
        .select("*")
        .order("timestamp", { ascending: false })
      if (error) throw error
      return data || []
    },
    refetchInterval: 600000,
    staleTime: 300000,
    retry: 2,
    refetchOnWindowFocus: false,
  })
}
