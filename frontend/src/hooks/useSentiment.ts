import { useQuery } from "@tanstack/react-query"
import { db } from "../lib/firebase"
import { collection, query, orderBy, getDocs } from "firebase/firestore"

export function useSentiment() {
  return useQuery({
    queryKey: ["sentiment", "latest"],
    queryFn: async () => {
      const q = query(
        collection(db, "sentiment_breakdown"),
        orderBy("timestamp", "desc")
      )
      
      const snapshot = await getDocs(q)
      return snapshot.docs.map(doc => {
        const docData = doc.data()
        return {
          id: doc.id,
          ...docData,
          timestamp: docData.timestamp?.toDate?.()?.toISOString() || docData.timestamp,
        }
      })
    },
    refetchInterval: 600000,
    staleTime: 300000,
    retry: 2,
    refetchOnWindowFocus: false,
  })
}
