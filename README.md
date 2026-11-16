# OpenBridge Matter Platform

**See the Matter devices in your Apple Home in [OpenBridge](https://github.com/nubisco/openbridge), locally, without adding them to HomeKit twice.**

[![npm](https://img.shields.io/npm/v/@nubisco/openbridge-matter-platform)](https://www.npmjs.com/package/@nubisco/openbridge-matter-platform)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Matter devices paired with Apple Home talk to Apple's hub, so OpenBridge cannot see them. This plugin uses Matter's _multi-admin_: OpenBridge joins each device as a second controller. The device stays in Apple Home exactly as it is, OpenBridge reads its state directly over your network, and nothing is published to HomeKit.

## Use it

1. Install it from the OpenBridge marketplace, or `npm install -g @nubisco/openbridge-matter-platform`.
2. In the Home app: the device, **Accessory Settings**, **Turn On Pairing Mode**. Copy the 11-digit code.
3. In OpenBridge: **Plugins**, **Matter Platform**, **Config**, add the code under **Pairing codes**, save, and restart OpenBridge.

Lights, plugs, switches, sensors (temperature, humidity, light, contact, motion, leak), blinds and thermostats are supported, read only. Thread devices are reached through your HomePod or Apple TV, with no Thread radio needed.

Full documentation: https://docs.nubisco.io/openbridge-matter-platform/

## Develop

```bash
npm install
npm run quality:check
```

See [docs/contributing.md](docs/contributing.md).

## License

MIT
