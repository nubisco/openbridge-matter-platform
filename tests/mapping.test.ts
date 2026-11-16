import { describe, expect, it } from 'vitest'
import { parseConfig } from '../src/config'
import {
  DEVICE_TYPE,
  deviceName,
  luxFrom,
  metricsOf,
  partName,
  telemetryOf,
  widgetTypeOf,
  type EndpointSnapshot,
} from '../src/mapping'

const ep = (deviceTypes: number[], clusters: EndpointSnapshot['clusters']): EndpointSnapshot => ({
  number: 1,
  deviceTypes,
  clusters,
})

describe('widgetTypeOf', () => {
  it('tells a light from a plug, though both only switch', () => {
    expect(widgetTypeOf(ep([DEVICE_TYPE.extendedColorLight], { onOff: { onOff: true } }))).toBe('light')
    expect(widgetTypeOf(ep([DEVICE_TYPE.onOffPlugInUnit], { onOff: { onOff: true } }))).toBe('outlet')
    expect(widgetTypeOf(ep([DEVICE_TYPE.mountedOnOffControl], { onOff: { onOff: true } }))).toBe('switch')
  })

  it('maps sensors, blinds and thermostats', () => {
    expect(widgetTypeOf(ep([DEVICE_TYPE.contactSensor], {}))).toBe('sensor')
    expect(widgetTypeOf(ep([DEVICE_TYPE.windowCovering], {}))).toBe('shutter')
    expect(widgetTypeOf(ep([DEVICE_TYPE.thermostat], {}))).toBe('thermostat')
  })

  it('falls back on clusters for an unknown type, and skips plumbing', () => {
    expect(widgetTypeOf(ep([0xfff0], { temperatureMeasurement: { measuredValue: 2000 } }))).toBe('sensor')
    expect(widgetTypeOf(ep([0xfff0], { onOff: { onOff: false } }))).toBe('switch')
    expect(widgetTypeOf(ep([0x000e], { descriptor: {} }))).toBeNull()
  })
})

describe('telemetryOf', () => {
  it("converts a light's level and colour", () => {
    const t = telemetryOf(
      ep([DEVICE_TYPE.extendedColorLight], {
        onOff: { onOff: true },
        levelControl: { currentLevel: 127 },
        colorControl: { currentHue: 127, currentSaturation: 254, colorMode: 0 },
      }),
      'light',
    )
    expect(t).toEqual({ active: true, brightness: 50, hue: 180, saturation: 100 })
  })

  it('reports colour temperature, not stale hue, in temperature mode', () => {
    const t = telemetryOf(
      ep([DEVICE_TYPE.colorTemperatureLight], {
        colorControl: { currentHue: 10, currentSaturation: 10, colorMode: 2, colorTemperatureMireds: 370 },
      }),
      'light',
    )
    expect(t).toEqual({ colorTemperature: 2703 })
  })

  it('converts measurements from hundredths, milliwatts and millivolts', () => {
    const t = telemetryOf(
      ep([DEVICE_TYPE.onOffPlugInUnit], {
        onOff: { onOff: true },
        electricalPowerMeasurement: { activePower: 86400, voltage: 229800 },
        electricalEnergyMeasurement: { cumulativeEnergyImported: { energy: 12_345_678 } },
      }),
      'outlet',
    )
    expect(t).toEqual({ active: true, power: 86.4, voltage: 229.8, totalForwardEnergy: 12.346 })
    const s = telemetryOf(
      ep([DEVICE_TYPE.temperatureSensor], {
        temperatureMeasurement: { measuredValue: 2154 },
        relativeHumidityMeasurement: { measuredValue: 4870 },
        powerSource: { batPercentRemaining: 170 },
      }),
      'sensor',
    )
    expect(s).toEqual({ currentTemperature: 21.5, currentHumidity: 48.7, battery: 85 })
  })

  it('reads a contact sensor and a leak detector the right way round', () => {
    expect(telemetryOf(ep([DEVICE_TYPE.contactSensor], { booleanState: { stateValue: true } }), 'sensor')).toEqual({
      contact: 'closed',
    })
    expect(telemetryOf(ep([DEVICE_TYPE.waterLeakDetector], { booleanState: { stateValue: true } }), 'sensor')).toEqual({
      leak: true,
    })
  })

  it('turns how closed a blind is into how open it is', () => {
    const t = telemetryOf(
      ep([DEVICE_TYPE.windowCovering], { windowCovering: { currentPositionLiftPercent100ths: 2500 } }),
      'shutter',
    )
    expect(t).toEqual({ position: 75 })
  })

  it("follows a thermostat's mode to the setpoint that matters", () => {
    const heat = { localTemperature: 2050, systemMode: 4, occupiedHeatingSetpoint: 2200, occupiedCoolingSetpoint: 2600 }
    expect(telemetryOf(ep([DEVICE_TYPE.thermostat], { thermostat: heat }), 'thermostat')).toEqual({
      currentTemperature: 20.5,
      targetTemperature: 22,
      active: true,
    })
    const cool = { ...heat, systemMode: 3 }
    expect(telemetryOf(ep([DEVICE_TYPE.thermostat], { thermostat: cool }), 'thermostat').targetTemperature).toBe(26)
    const off = { ...heat, systemMode: 0 }
    expect(telemetryOf(ep([DEVICE_TYPE.thermostat], { thermostat: off }), 'thermostat').active).toBe(false)
  })

  it('leaves out what the device has not reported, rather than reporting zero', () => {
    expect(telemetryOf(ep([DEVICE_TYPE.temperatureSensor], { temperatureMeasurement: {} }), 'sensor')).toEqual({})
  })

  it("decodes Matter's logarithmic lux", () => {
    expect(luxFrom(0)).toBe(0)
    expect(luxFrom(20001)).toBe(100)
  })
})

describe('naming and metrics', () => {
  it('prefers the label the person gave, then the product', () => {
    expect(deviceName({ nodeLabel: 'Hall sensor', productName: 'Eve Door' }, { number: 1 }, false)).toBe('Hall sensor')
    expect(deviceName({ productName: 'Eve Door' }, { number: 1 }, false)).toBe('Eve Door')
    expect(deviceName({}, { number: 2 }, true)).toBe('Matter device 2')
    expect(deviceName({ productName: 'Lamp' }, { number: 2, label: 'temperature' }, true)).toBe('Lamp temperature')
  })

  it('names a part by what it is', () => {
    expect(partName('sensor', { currentTemperature: 20 })).toBe('temperature')
    expect(partName('shutter', {})).toBe('blind')
  })

  it('charts only what the device reports', () => {
    expect(metricsOf({ active: true }).map((m) => m.key)).toEqual([])
    expect(metricsOf({ currentTemperature: 20, battery: 90 }).map((m) => m.key)).toEqual([
      'currentTemperature',
      'battery',
    ])
  })
})

describe('parseConfig', () => {
  it('defaults, and drops what is malformed instead of failing', () => {
    expect(parseConfig(undefined)).toEqual({ pairingCodes: [], refreshSeconds: 60 })
    expect(parseConfig({ pairingCodes: ['3497-011-2332', '', 7], refreshSeconds: 5 })).toEqual({
      pairingCodes: ['3497-011-2332'],
      refreshSeconds: 60,
    })
    expect(parseConfig({ refreshSeconds: 30 }).refreshSeconds).toBe(30)
  })
})
