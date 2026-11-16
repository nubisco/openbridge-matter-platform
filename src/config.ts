export interface MatterConfig {
  pairingCodes: string[]
  refreshSeconds: number
}

/** The plugin's config, with defaults, and anything malformed dropped rather than fatal. */
export function parseConfig(raw: Record<string, unknown> | undefined): MatterConfig {
  const codes = Array.isArray(raw?.pairingCodes) ? raw!.pairingCodes : []
  const refresh = Number(raw?.refreshSeconds)
  return {
    pairingCodes: codes.filter((c): c is string => typeof c === 'string' && c.trim() !== ''),
    refreshSeconds: Number.isFinite(refresh) && refresh >= 10 && refresh <= 3600 ? Math.round(refresh) : 60,
  }
}
