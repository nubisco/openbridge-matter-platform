---
layout: nubisco
title: 'Pairing a device'
intro: 'Give OpenBridge a setup code from the Home app. The device stays in Apple Home.'
---

1. Install the plugin from the OpenBridge marketplace, or with `npm install -g @nubisco/openbridge-matter-platform`.
2. In the Home app, open the device, then **Accessory Settings**, then **Turn On Pairing Mode**. The Home app shows an 11-digit setup code. It works for about 15 minutes.
3. In OpenBridge, open **Plugins**, then **Matter Platform**, then **Config**, and add the code under **Pairing codes**. Save.
4. Restart OpenBridge (Settings, **Restart Daemon**).

OpenBridge pairs the device in the background and logs `Paired …`. The device then appears on the Devices page. Pair several devices at once by adding several codes.

Each code is used once. OpenBridge remembers which codes it used (only a fingerprint, never the code), so you can leave old codes in the list or remove them after pairing.

## Where it keeps its keys

OpenBridge's Matter fabric, its keys and the list of paired devices are kept in `~/.openbridge/matter`. Deleting that folder makes OpenBridge forget every device, and each would have to be paired again.

## Removing a device

Removing a device from Apple Home does not remove it from OpenBridge, and the other way round. To take a device away from OpenBridge only, open it in the Home app, where **Accessory Settings** lists the controllers it belongs to, and remove OpenBridge there.
