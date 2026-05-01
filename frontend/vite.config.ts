import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

const projectId =
  process.env.VITE_FIREBASE_PROJECT_ID ||
  process.env.FIREBASE_PROJECT_ID ||
  "pulsetracker-0000"

const defaultFunctionsOrigin = `http://localhost:5001/${projectId}/us-central1`
const functionsOrigin =
  process.env.VITE_FUNCTIONS_EMULATOR_ORIGIN ||
  process.env.FUNCTIONS_EMULATOR_ORIGIN ||
  defaultFunctionsOrigin

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: functionsOrigin,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
        secure: false,
      },
    },
  },
})
