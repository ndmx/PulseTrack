import { useQuery } from "@tanstack/react-query"
import { db } from "../lib/firebase"
import { collection, query, where, orderBy, getDocs, Timestamp } from "firebase/firestore"
import dayjs from "dayjs"

export function useApprovalData() {
  return useQuery({
    queryKey: ["approval", "30d"],
    queryFn: async () => {
      const cutoffDate = dayjs().subtract(30, "day").toDate()
      const q = query(
        collection(db, "approval_ratings"),
        where("timestamp", ">=", Timestamp.fromDate(cutoffDate)),
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
          change_delta: docData.change_delta,
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
