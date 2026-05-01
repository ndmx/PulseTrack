import { useQuery } from "@tanstack/react-query"
import { db } from "../lib/firebase"
import { collection, query, orderBy, getDocs } from "firebase/firestore"

export type DemographicsRecord = {
  id: string
  state?: string
  zone?: string
  total_population?: number
  voting_age_population?: number
  registered_voters?: number
  political_affiliation?: string
  tribal_affiliation?: string
  [key: string]: unknown
}

export function useDemographics() {
  return useQuery({
    queryKey: ["demographics", "all"],
    queryFn: async () => {
      const q = query(
        collection(db, "state_demographics"),
        orderBy("registered_voters", "desc")
      )
      
      const snapshot = await getDocs(q)
      return snapshot.docs.map((doc): DemographicsRecord => ({
        id: doc.id,
        ...doc.data()
      }))
    },
    refetchInterval: 3600000,
    staleTime: 1800000,
    retry: 2,
    refetchOnWindowFocus: false,
  })
}
