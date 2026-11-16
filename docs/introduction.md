---
layout: nubisco
title: 'Introduction'
intro: 'How OpenBridge reads devices that belong to Apple Home.'
---

Devices that work with Apple Home over Matter talk to Apple's hub, not to OpenBridge, so OpenBridge cannot see them. Adding them to OpenBridge through a plugin of their own would also add them to HomeKit a second time.

Matter has a way round both problems. A Matter device can be paired with more than one controller (Matter calls this _multi-admin_). This plugin makes OpenBridge one of those controllers. You open a pairing window for the device in the Home app, give OpenBridge the code, and OpenBridge joins the device to its own Matter fabric. From then on:

- the device stays in Apple Home, unchanged, and Apple keeps controlling it
- OpenBridge reads its state directly over your local network, and records it
- nothing is published to HomeKit, so the device does not appear twice

## What it reads

| Matter device                       | Shown in OpenBridge as | What it reports                                          |
| ----------------------------------- | ---------------------- | -------------------------------------------------------- |
| Light (on/off, dimmable, colour)    | Light                  | On, brightness, colour or colour temperature             |
| Plug                                | Outlet                 | On, power, voltage, energy (when the plug measures them) |
| Wall switch or dimmer               | Switch                 | On, level                                                |
| Temperature, humidity, light sensor | Sensor                 | Temperature, humidity, light level, battery              |
| Contact, motion, water leak sensor  | Sensor                 | Open or closed, motion, leak, battery                    |
| Blind or shade                      | Shutter                | How far it is open                                       |
| Thermostat                          | Thermostat             | Room temperature, target, on or off                      |

A device with several parts, such as a lamp with a temperature sensor, appears once per part. A Matter bridge (a hub that exposes its own devices) shows each of its devices.

## What it does not do yet

It only reads. Control your devices from Apple Home as you do now.
