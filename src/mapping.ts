/**
 * What a Matter endpoint is, in OpenBridge's terms, and what it reports.
 *
 * Pure functions over a plain snapshot of an endpoint's cluster states, so
 * the mapping is tested without a network, a fabric or matter.js itself.
 * Cluster state is keyed by matter.js behavior id (`onOff`, `levelControl`),
 * with attribute values as Matter encodes them: hundredths of a degree,
 * levels out of 254, milliwatts.
 */

export type ClusterStates = Record<string, Record<string, unknown> | undefined>

export interface EndpointSnapshot {
  number: number
  /** Device type ids from the Descriptor cluster. */
  deviceTypes: number[]
  clusters: ClusterStates
}

/** Matter device type ids this plugin knows, from the Matter device library. */
export const DEVICE_TYPE = {
  onOffLight: 0x0100,
  dimmableLight: 0x0101,
  colorTemperatureLight: 0x010c,
  extendedColorLight: 0x010d,
  onOffPlugInUnit: 0x010a,
  dimmablePlugInUnit: 0x010b,
  mountedOnOffControl: 0x010f,
  mountedDimmableLoadControl: 0x0110,
  contactSensor: 0x0015,
  waterLeakDetector: 0x0043,
  lightSensor: 0x0106,
  occupancySensor: 0x0107,
  temperatureSensor: 0x0302,
  humiditySensor: 0x0307,
  airQualitySensor: 0x002c,
  windowCovering: 0x0202,
  thermostat: 0x0301,
  fan: 0x002b,
  airPurifier: 0x002d,
} as const

const LIGHTS: number[] = [
  DEVICE_TYPE.onOffLight,
  DEVICE_TYPE.dimmableLight,
  DEVICE_TYPE.colorTemperatureLight,
  DEVICE_TYPE.extendedColorLight,
]
const PLUGS: number[] = [DEVICE_TYPE.onOffPlugInUnit, DEVICE_TYPE.dimmablePlugInUnit]
const MOUNTED: number[] = [DEVICE_TYPE.mountedOnOffControl, DEVICE_TYPE.mountedDimmableLoadControl]
const SENSORS: number[] = [
  DEVICE_TYPE.contactSensor,
  DEVICE_TYPE.waterLeakDetector,
  DEVICE_TYPE.lightSensor,
  DEVICE_TYPE.occupancySensor,
  DEVICE_TYPE.temperatureSensor,
  DEVICE_TYPE.humiditySensor,
  DEVICE_TYPE.airQualitySensor,
]

/**
 * The OpenBridge widget an endpoint is shown as, or null for an endpoint
 * that is plumbing (the root, a bridge's aggregator, a power source alone).
 * Device types win over clusters: a plug and a light both have OnOff, and
 * only the device type says which one it is.
 */
export function widgetTypeOf(ep: EndpointSnapshot): string | null {
  const has = (types: number[]) => ep.deviceTypes.some((t) => types.includes(t))
  if (has(LIGHTS)) return 'light'
  if (has(PLUGS)) return 'outlet'
  if (has(MOUNTED)) return 'switch'
  if (has([DEVICE_TYPE.windowCovering])) return 'shutter'
  if (has([DEVICE_TYPE.thermostat])) return 'thermostat'
  if (has([DEVICE_TYPE.fan, DEVICE_TYPE.airPurifier])) return 'switch'
  if (has(SENSORS)) return 'sensor'
  // An endpoint whose type is unknown but which measures something is still
  // worth seeing. One that only switches is shown as a switch.
  const c = ep.clusters
  if (c.temperatureMeasurement || c.relativeHumidityMeasurement || c.booleanState || c.occupancySensing) return 'sensor'
  if (c.onOff) return 'switch'
  return null
}

const num = (v: unknown): number | undefined => {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'bigint') return Number(v)
  return undefined
}
const round = (v: number, places = 1) => Math.round(v * 10 ** places) / 10 ** places

/** Matter's lux encoding: 10000 × log10(lux) + 1, with 0 meaning too dark to measure. */
export function luxFrom(measured: number): number {
  return measured <= 0 ? 0 : round(10 ** ((measured - 1) / 10000), 0)
}

/**
 * The telemetry OpenBridge records, under the keys its UI already reads
 * (`active`, `brightness`, `currentTemperature`, `currentHumidity`, `power`).
 * A value the device has not reported yet is left out, never zero.
 */
export function telemetryOf(ep: EndpointSnapshot, widgetType: string): Record<string, unknown> {
  const c = ep.clusters
  const t: Record<string, unknown> = {}
  const onOff = c.onOff?.onOff
  if (typeof onOff === 'boolean') t.active = onOff

  const level = num(c.levelControl?.currentLevel)
  if (level !== undefined && (widgetType === 'light' || widgetType === 'outlet' || widgetType === 'switch')) {
    t.brightness = Math.round((Math.max(1, level) / 254) * 100)
  }
  const cc = c.colorControl
  if (cc) {
    const hue = num(cc.currentHue)
    const sat = num(cc.currentSaturation)
    const mode = num(cc.colorMode)
    // Colour mode 2 is colour temperature: hue and saturation are then stale.
    if (hue !== undefined && sat !== undefined && mode !== 2) {
      t.hue = Math.round((hue / 254) * 360)
      t.saturation = Math.round((sat / 254) * 100)
    }
    const mireds = num(cc.colorTemperatureMireds)
    if (mireds && mode === 2) t.colorTemperature = Math.round(1_000_000 / mireds)
  }

  const temp = num(c.temperatureMeasurement?.measuredValue)
  if (temp !== undefined) t.currentTemperature = round(temp / 100)
  const hum = num(c.relativeHumidityMeasurement?.measuredValue)
  if (hum !== undefined) t.currentHumidity = round(hum / 100)
  const lux = num(c.illuminanceMeasurement?.measuredValue)
  if (lux !== undefined) t.illuminance = luxFrom(lux)
  const occ = c.occupancySensing?.occupancy
  if (occ && typeof occ === 'object') t.occupancy = !!(occ as { occupied?: boolean }).occupied
  const state = c.booleanState?.stateValue
  if (typeof state === 'boolean') {
    // The same attribute means opposite things: a contact sensor is true
    // when closed, a leak detector is true when it found water.
    if (ep.deviceTypes.includes(DEVICE_TYPE.waterLeakDetector)) t.leak = state
    else t.contact = state ? 'closed' : 'open'
  }

  const power = num(c.electricalPowerMeasurement?.activePower)
  if (power !== undefined) t.power = round(power / 1000)
  const voltage = num(c.electricalPowerMeasurement?.voltage)
  if (voltage !== undefined) t.voltage = round(voltage / 1000)
  const energy = c.electricalEnergyMeasurement?.cumulativeEnergyImported
  const mwh = energy && typeof energy === 'object' ? num((energy as { energy?: unknown }).energy) : undefined
  if (mwh !== undefined) t.totalForwardEnergy = round(mwh / 1_000_000, 3)

  const wc = c.windowCovering
  if (wc) {
    // Matter counts how far it is closed, OpenBridge how far it is open.
    const closed = num(wc.currentPositionLiftPercent100ths)
    if (closed !== undefined) t.position = Math.round(100 - closed / 100)
  }

  const th = c.thermostat
  if (th) {
    const local = num(th.localTemperature)
    if (local !== undefined) t.currentTemperature = round(local / 100)
    const mode = num(th.systemMode)
    // System mode 3 is cooling, so the cooling setpoint is the target.
    const setpoint = num(mode === 3 ? th.occupiedCoolingSetpoint : th.occupiedHeatingSetpoint)
    if (setpoint !== undefined) t.targetTemperature = round(setpoint / 100)
    if (mode !== undefined) t.active = mode !== 0
  }

  const battery = num(c.powerSource?.batPercentRemaining)
  if (battery !== undefined) t.battery = Math.round(battery / 2)
  return t
}

/** The series worth charting, for the telemetry this endpoint has. */
export function metricsOf(telemetry: Record<string, unknown>) {
  const out: Array<{ key: string; label: string; unit: string; kind: 'instant' | 'cumulative'; precision?: number }> =
    []
  if ('currentTemperature' in telemetry)
    out.push({ key: 'currentTemperature', label: 'Temperature', unit: '°C', kind: 'instant', precision: 1 })
  if ('currentHumidity' in telemetry)
    out.push({ key: 'currentHumidity', label: 'Humidity', unit: '%', kind: 'instant', precision: 0 })
  if ('illuminance' in telemetry) out.push({ key: 'illuminance', label: 'Light', unit: 'lx', kind: 'instant' })
  if ('power' in telemetry) out.push({ key: 'power', label: 'Power', unit: 'W', kind: 'instant', precision: 1 })
  if ('totalForwardEnergy' in telemetry)
    out.push({ key: 'totalForwardEnergy', label: 'Energy', unit: 'kWh', kind: 'cumulative', precision: 3 })
  if ('battery' in telemetry) out.push({ key: 'battery', label: 'Battery', unit: '%', kind: 'instant', precision: 0 })
  return out
}

/** A stable OpenBridge id for one endpoint of one node. */
export const deviceId = (nodeId: string, endpoint: number) => `matter-${nodeId}-${endpoint}`

/**
 * The name a person sees. The label they gave the device wins, then the
 * product name. A device with several useful endpoints (a double socket)
 * gets the endpoint's own label, or its number.
 */
export function deviceName(
  info: { nodeLabel?: string; productName?: string; vendorName?: string },
  endpoint: { number: number; label?: string },
  several: boolean,
): string {
  const base = info.nodeLabel?.trim() || info.productName?.trim() || info.vendorName?.trim() || 'Matter device'
  if (!several) return base
  return `${base} ${endpoint.label?.trim() || endpoint.number}`
}

/**
 * What one part of a device is, for its name when a device has parts of
 * different kinds: a lamp with a temperature sensor in it is "Desk lamp
 * light" and "Desk lamp temperature", not "Desk lamp 1" and "2".
 */
export function partName(widgetType: string, telemetry: Record<string, unknown>): string {
  if (widgetType === 'sensor') {
    if ('currentTemperature' in telemetry) return 'temperature'
    if ('currentHumidity' in telemetry) return 'humidity'
    if ('contact' in telemetry) return 'contact'
    if ('occupancy' in telemetry) return 'motion'
    if ('leak' in telemetry) return 'leak'
    if ('illuminance' in telemetry) return 'light level'
    return 'sensor'
  }
  return (
    { light: 'light', outlet: 'outlet', switch: 'switch', shutter: 'blind', thermostat: 'thermostat' }[widgetType] ??
    widgetType
  )
}
