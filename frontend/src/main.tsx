import React from "react"
import ReactDOM from "react-dom/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createBrowserRouter, RouterProvider } from "react-router-dom"
import RouteError from "./components/RouteError"
import App from "./app"
import SnapstatsPage from "./routes/SnapstatsPage"
import PulseTrackPage from "./routes/PulseTrackPage"
import "./styles.css"

const qc = new QueryClient()
const router = createBrowserRouter([
  { path: "/", element: <App />, errorElement: <RouteError /> },
  { path: "/pulsetrack", element: <PulseTrackPage />, errorElement: <RouteError /> },
  { path: "/snapstats", element: <SnapstatsPage />, errorElement: <RouteError /> },
])

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>
)
