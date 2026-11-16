---
layout: nubisco
title: 'Troubleshooting'
intro: 'When a device does not pair or does not report.'
---

## "Could not pair with code ending …"

- **The code expired.** A pairing window lasts about 15 minutes. Open a new one in the Home app, put the new code in the config, and restart OpenBridge.
- **The device is not on the same network.** OpenBridge finds the device over mDNS (`_matterc._udp`) on the local network, so it must run on the same network as the device, with IPv6 enabled.
- **The device has no room for another controller.** Most devices allow five. Apple Home uses two of them (your home and iCloud Keychain). Remove a controller you no longer use, or reset the device.

## Thread devices

OpenBridge needs no Thread radio. It reaches Thread devices through a Thread border router, such as a HomePod mini, a HomePod or an Apple TV 4K. The machine running OpenBridge has to accept the route the border router announces. On Linux, check that a route to the Thread network exists:

```sh
ip -6 route | grep via
```

You should see a `/64` route through a `fe80::` address. If not, enable router advertisements on the network interface, with `accept_ra=1` and `accept_ra_rt_info_max_plen=64`.

## A device shows as not answering

A device that stays disconnected stops reporting, and OpenBridge marks it as not answering after a few minutes, as it does for any device. Sleepy battery devices may take longer to reconnect after OpenBridge restarts.
