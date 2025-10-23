import { useQuery } from "@tanstack/react-query"
import { db } from "../lib/firebase"
import { collection, query, orderBy, getDocs } from "firebase/firestore"

export function useDemographics() {
  return useQuery({
    queryKey: ["demographics", "all"],
    queryFn: async () => {
      const q = query(
        collection(db, "state_demographics"),
        orderBy("registered_voters", "desc")
      )
      
      const snapshot = await getDocs(q)
      return snapshot.docs.map(doc => ({
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
