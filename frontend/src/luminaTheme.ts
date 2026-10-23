import { designVariations, registryEntries, resolveSchemeVars, roleColors } from "@xlumina/system"

// Lumina Design System · Variation 04 · Created by ndmx
// The website uses the light Atelier canvas and Map Safety Glass roles.
const variation = designVariations["design-variation-04"]
const profile = registryEntries.find((entry) => entry.id === variation.id)

export function applyLuminaTheme() {
  const root = document.documentElement
  for (const [name, value] of Object.entries(resolveSchemeVars("light", variation.defaultEra))) {
    root.style.setProperty(name, value)
  }

  root.style.setProperty("--ls-accent", variation.accent)
  root.style.setProperty("--ls-accent-2", profile?.tokenOverrides?.accentSecondary ?? "#d9542f")
  root.style.setProperty("--pulse-danger", roleColors.status.danger)
  root.style.setProperty("--pulse-positive", roleColors.status.success)
}
