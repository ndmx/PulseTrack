import { useQuery } from "@tanstack/react-query"
import { supabase } from "../lib/supabase"

export function useDemographics() {
  return useQuery({
    queryKey: ["demographics", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("state_demographics")
        .select("*")
        .order("registered_voters", { ascending: false })
      if (error) throw error
      return data || []
    },
    refetchInterval: 3600000,
    staleTime: 1800000,
    retry: 2,
    refetchOnWindowFocus: false,
  })
}
