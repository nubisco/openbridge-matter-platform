/**
 * OpenBridge Matter Platform: reads Matter devices that live in Apple Home
 * (or any other Matter ecosystem) by joining them as a second controller.
 * See controller.ts for how, and docs/ for the person's side of it.
 */
import { homedir } from 'node:os'
import { join } from 'node:path'
import { parseConfig } from './config'
import { MatterBridge } from './controller'

// The OpenBridge SDK is ESM-only and plugins compile to CommonJS, so the few
// types this plugin needs are copied here, as the other plugins do.
interface PluginLogger {
  info(message: string, ...args: unknown[]): void
  warn(message: string, ...args: unknown[]): void
  error(message: string, ...args: unknown[]): void
  debug(message: string, ...args: unknown[]): void
}
interface PluginContext {
  config: Record<string, unknown>
  log: PluginLogger
  reportTelemetry(deviceId: string, data: Record<string, unknown>): void
  registerDevice(device: Parameters<ConstructorParameters<typeof MatterBridge>[0]['registerDevice']>[0]): void
}

const pkg = require('../package.json') as { name: string; version: string; description: string }

let bridge: MatterBridge | null = null

const plugin = {
  manifest: { name: pkg.name, version: pkg.version, description: pkg.description, author: 'Nubisco' },

  async start(ctx: PluginContext): Promise<void> {
    const config = parseConfig(ctx.config)
    bridge = new MatterBridge(ctx, {
      dataDir: join(homedir(), '.openbridge', 'matter'),
      pairingCodes: config.pairingCodes,
      refreshSeconds: config.refreshSeconds,
    })
    await bridge.start()
  },

  async stop(): Promise<void> {
    await bridge?.stop()
    bridge = null
  },
}

module.exports = plugin
