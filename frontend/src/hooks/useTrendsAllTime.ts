import { useQuery } from "@tanstack/react-query"
import { db } from "../lib/firebase"
import { collection, query, orderBy, getDocs } from "firebase/firestore"

export function useTrendsAllTime() {
  return useQuery({
    queryKey: ["trends", "all"],
    queryFn: async () => {
      const q = query(
        collection(db, "approval_ratings"),
        orderBy("timestamp", "asc")
      )
      
      const snapshot = await getDocs(q)
      const data = snapshot.docs.map(doc => {
        const docData = doc.data()
        return {
          id: doc.id,
          timestamp: docData.timestamp?.toDate?.()?.toISOString() || docData.timestamp,
          candidate: docData.candidate,
          rating_score: docData.rating_score,
          state: docData.state,
        }
      })
      
      // Filter for National or null state
      return data.filter(item => item.state === "National" || !item.state)
    },
    refetchInterval: 600000,
    staleTime: 300000,
    retry: 2,
    refetchOnWindowFocus: false,
  })
}
