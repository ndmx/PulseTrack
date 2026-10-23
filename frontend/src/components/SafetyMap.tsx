import { useEffect, useRef } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import type { SafetyIncident } from "../lib/safety"

type Props = {
  incidents: SafetyIncident[]
  center: [number, number] | null
  onSelect: (id: string) => void
  visible: boolean
}

export default function SafetyMap({ incidents, center, onSelect, visible }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const pins = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    if (!host.current || map.current) return
    const instance = L.map(host.current, { zoomControl: false, scrollWheelZoom: false }).setView([20, 0], 2)
    L.control.zoom({ position: "bottomright" }).addTo(instance)
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 18,
    }).addTo(instance)
    pins.current = L.layerGroup().addTo(instance)
    map.current = instance
    return () => {
      instance.remove()
      map.current = null
      pins.current = null
    }
  }, [])

  useEffect(() => {
    const layer = pins.current
    if (!layer) return
    layer.clearLayers()
    incidents.forEach(incident => {
      if (incident.locationPending || incident.latitude === null || incident.longitude === null) return
      const color = incident.severity === "Urgent" ? "#ff696b" : incident.severity === "High" ? "#ffaf67" : "#42d2ad"
      const marker = L.circleMarker([incident.latitude, incident.longitude], {
        radius: incident.severity === "Urgent" ? 10 : 8,
        color: "#0b1420", weight: 2, fillColor: color, fillOpacity: 0.94,
      })
      marker.on("click", () => onSelect(incident.id))
      marker.addTo(layer)
    })
  }, [incidents, onSelect])

  useEffect(() => {
    if (center) map.current?.setView(center, 11)
  }, [center])

  useEffect(() => {
    if (visible) window.setTimeout(() => map.current?.invalidateSize(), 60)
  }, [visible])

  return <div ref={host} className="safety-map-canvas" role="img" aria-label="Map of community incident locations. Select an incident from the list for an accessible detail view." />
}
