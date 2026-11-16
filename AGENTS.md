# AGENTS.md

Guidance for agents working on this repository. The Nubisco standards in the workspace's `AGENTS.md` apply first.

## What this is

**openbridge-matter-platform** is a native OpenBridge plugin that makes OpenBridge a second Matter controller (multi-admin) for devices already paired with Apple Home or another ecosystem. It **reads** their state and reports it as OpenBridge telemetry. It never publishes anything to HomeKit, which is the point: the devices are already in HomeKit through Apple.

## Layout

```
src/
  index.ts        → plugin object (manifest, start, stop). module.exports = plugin
  config.ts       → parseConfig: defaults, drops malformed values, never throws
  controller.ts   → MatterBridge: matter.js ServerNode + ControllerBehavior, pairing, subscriptions
  mapping.ts      → pure: endpoint snapshot → widgetType, telemetry, metrics, names
tests/
  mapping.test.ts → every unit conversion and mapping rule
```

## Rules

- **matter.js 0.18 API only:** `ServerNode` + `ControllerBehavior`, peers are `ClientNode`s in `node.peers`. `CommissioningController` and `PairedNode` are deprecated and removed in 0.19.
- **Module format:** CommonJS output with `"module": "node16"`. Plain `"commonjs"` resolution ignores package `exports` and cannot see `@matter/main/behaviors/*`.
- **Telemetry keys** are the ones the OpenBridge UI already reads: `active`, `brightness`, `hue`, `saturation`, `currentTemperature`, `currentHumidity`, `targetTemperature`, `power`, `position`, `reachable`. Do not invent synonyms.
- **Units:** convert in `mapping.ts` only. Matter sends hundredths of a degree, levels out of 254, milliwatts, millivolts, milliwatt-hours, and how far a blind is _closed_.
- **Never report a value the device has not sent.** Leave the key out rather than send 0.
- **Pairing codes are secrets** for their 15 minutes. Log only the last four digits. Store only a fingerprint.
- **Storage:** `~/.openbridge/matter`. Deleting it forgets every paired device.
- Plugin startup must not wait for pairing. Pairing runs in the background.

## Checking a change

`npm run quality:check`. For anything touching `controller.ts`, also run the virtual-device end-to-end check described in `docs/contributing.md`.
