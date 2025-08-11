import React, { createContext, useContext, useEffect, useMemo, useState } from "react"

type ThemeCtx = { darkMode: boolean; toggle: () => void }
const Ctx = createContext<ThemeCtx>({ darkMode: false, toggle: () => {} })

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try { return localStorage.getItem("pulsetrack.dark") === "1" } catch { return false }
  })
  useEffect(() => {
    try { localStorage.setItem("pulsetrack.dark", darkMode ? "1" : "0") } catch {}
  }, [darkMode])
  const value = useMemo(() => ({ darkMode, toggle: () => setDarkMode(v => !v) }), [darkMode])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useTheme = () => useContext(Ctx)
