---
layout: nubisco
title: 'Contributing'
intro: 'How the plugin is built, and how to check a change before it ships.'
---

## Setup

```bash
git clone https://github.com/nubisco/openbridge-matter-platform.git
cd openbridge-matter-platform
npm install
npm run quality:check   # tests, lint, format and types
```

## How it is put together

- `src/index.ts`: the OpenBridge plugin object. It starts and stops the controller.
- `src/controller.ts`: OpenBridge as a Matter controller, on [matter.js](https://github.com/project-chip/matter.js). It pairs new codes, keeps the paired devices connected, and turns their attribute changes into OpenBridge telemetry.
- `src/mapping.ts`: pure functions from a Matter endpoint (its device types and cluster states) to an OpenBridge widget type, telemetry and metrics. Every unit conversion lives here, and `tests/mapping.test.ts` covers it.

## Checking against a real Matter device without owning one

matter.js can also be a Matter device. Run a virtual light and temperature sensor in one terminal, then pair the plugin's controller with it in another, and watch the telemetry it reports. Both scripts are in the repository's history of the first release, and the shape is:

1. A `ServerNode` with an `OnOffLightDevice` and a `TemperatureSensorDevice` endpoint, on its own port and storage folder, printing `node.state.commissioning.pairingCodes.manualPairingCode`.
2. `new MatterBridge(host, { dataDir, pairingCodes: [code], refreshSeconds: 10 })` with a `host` that logs `registerDevice` and `reportTelemetry`.

Name such scripts `*.local.*`. They are ignored by git and never committed.
