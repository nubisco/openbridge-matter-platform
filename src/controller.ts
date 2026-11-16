/**
 * OpenBridge as a second Matter controller.
 *
 * Matter lets one device belong to several controllers at once (multi-admin).
 * The person keeps their devices in Apple Home, opens a pairing window there,
 * and this joins the device to OpenBridge's own fabric. From then on it reads
 * the device directly over the local network, with no cloud and without
 * touching Apple's pairing. Nothing here is published to HomeKit, so nothing
 * shows up twice in the Home app.
 *
 * Reading only, for now: the device keeps being controlled from Apple Home.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  ChangeNotificationService,
  ClientNode,
  ClusterBehavior,
  ControllerBehavior,
  Environment,
  NodeConnectionState,
  ServerNode,
} from '@matter/main'
import { BasicInformationClient } from '@matter/main/behaviors/basic-information'
import { DescriptorClient } from '@matter/main/behaviors/descriptor'
import {
  deviceId,
  deviceName,
  partName,
  metricsOf,
  telemetryOf,
  widgetTypeOf,
  type ClusterStates,
  type EndpointSnapshot,
} from './mapping'

export interface Host {
  log: { info(m: string): void; warn(m: string): void; error(m: string): void; debug(m: string): void }
  registerDevice(d: {
    id: string
    name: string
    widgetType: string
    manufacturer?: string
    model?: string
    metrics?: ReturnType<typeof metricsOf>
    telemetryIntervalSeconds?: number
  }): void
  reportTelemetry(id: string, data: Record<string, unknown>): void
}

export interface ControllerOptions {
  /** Where the fabric, its keys and the paired devices are kept. */
  dataDir: string
  /** Setup codes from Apple Home's "Turn On Pairing Mode". Each is used once. */
  pairingCodes: string[]
  /** How often a connected device's state is re-reported, in seconds. */
  refreshSeconds: number
}

/** A pairing code is a secret for its 15 minutes, so only its hash is kept. */
const fingerprint = (code: string) => createHash('sha256').update(code.replace(/\D/g, '')).digest('hex').slice(0, 16)

interface State {
  /** Fingerprints of the codes already used, so a restart does not pair twice. */
  used: string[]
}

export class MatterBridge {
  private node: ServerNode | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  private readonly registered = new Set<string>()
  /** Closing disconnects every device, which is not news worth reporting. */
  private stopping = false
  private readonly statePath: string

  constructor(
    private readonly host: Host,
    private readonly opts: ControllerOptions,
  ) {
    mkdirSync(opts.dataDir, { recursive: true })
    this.statePath = join(opts.dataDir, 'openbridge-state.json')
  }

  private readState(): State {
    try {
      if (existsSync(this.statePath)) return { used: [], ...JSON.parse(readFileSync(this.statePath, 'utf8')) }
    } catch {
      /* a broken file is treated as empty: at worst a code is tried again */
    }
    return { used: [] }
  }

  private writeState(s: State): void {
    writeFileSync(this.statePath, JSON.stringify(s, null, 2))
  }

  async start(): Promise<void> {
    const env = Environment.default
    env.vars.set('storage.path', this.opts.dataDir)
    // OpenBridge owns the process: no signal handlers, no exit codes.
    env.vars.set('runtime.signals', false)
    env.vars.set('runtime.exitcode', false)
    env.vars.set('log.level', 'warn')

    const node = await ServerNode.create(ServerNode.RootEndpointWithoutGroupcast.with(ControllerBehavior), {
      environment: env,
      id: 'openbridge',
      commissioning: { enabled: false },
      controller: { adminFabricLabel: 'OpenBridge' },
      subscriptions: { persistenceEnabled: false },
    })
    this.node = node

    node.env.get(ChangeNotificationService).change.on((c) => {
      if (c.kind !== 'update' || !ClusterBehavior.is(c.behavior)) return
      const peer = c.endpoint.ownerOfType(ClientNode.RootEndpoint)
      if (peer instanceof ClientNode) this.report(peer)
    })
    node.peers.added.on((p) => this.watch(p))

    await node.start()
    for (const p of node.peers.commissioned) this.watch(p)
    // Pairing can take a minute. OpenBridge's startup does not wait for it.
    void this.pairNew()

    this.timer = setInterval(() => {
      for (const p of node.peers.commissioned) {
        if (p.lifecycle.isSeeded && this.connected(p)) this.report(p)
      }
    }, this.opts.refreshSeconds * 1000)
    const count = [...node.peers.commissioned].length
    this.host.log.info(`Matter controller running with ${count} device${count === 1 ? '' : 's'}`)
  }

  async stop(): Promise<void> {
    this.stopping = true
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    await this.node?.close()
    this.node = null
  }

  /** Pair every configured code not used before. A failure is logged, never fatal. */
  private async pairNew(): Promise<void> {
    const state = this.readState()
    for (const raw of this.opts.pairingCodes) {
      const code = raw.replace(/\D/g, '')
      const fp = fingerprint(code)
      if (!code || state.used.includes(fp)) continue
      if (code.length !== 11 && code.length !== 21) {
        this.host.log.warn(`Pairing code ending ${code.slice(-4)} is not an 11 or 21 digit Matter code, skipped`)
        continue
      }
      this.host.log.info(`Pairing the device with code ending ${code.slice(-4)}`)
      try {
        const peer = await this.node!.peers.commission({
          pairingCode: code,
          discoveryCapabilities: { onIpNetwork: true },
        })
        state.used.push(fp)
        this.writeState(state)
        this.host.log.info(`Paired ${peer.id}. It can be removed from the pairing codes now.`)
      } catch (e) {
        this.host.log.error(
          `Could not pair with code ending ${code.slice(-4)}: ${(e as Error).message}. ` +
            'Open a new pairing window in the Home app (codes last about 15 minutes) and restart OpenBridge.',
        )
      }
    }
  }

  private connected(p: ClientNode): boolean {
    const s = p.lifecycle.connectionState
    return s === NodeConnectionState.Connected || s === NodeConnectionState.Reconnecting
  }

  private watch(p: ClientNode): void {
    p.lifecycle.connectionStateChanged.on((s) => {
      if (this.stopping) return
      if (s === NodeConnectionState.Connected) this.report(p)
      else if (s === NodeConnectionState.WaitingForDeviceDiscovery || s === NodeConnectionState.Disconnected) {
        // Said once, then silence: the device goes stale and OpenBridge's
        // notifications take it from there.
        for (const id of this.idsOf(p)) this.host.reportTelemetry(id, { reachable: false })
      }
    })
    const ready = () => this.report(p)
    if (p.lifecycle.isSeeded) ready()
    else p.lifecycle.seeded.on(ready)
  }

  private idsOf(p: ClientNode): string[] {
    return [...this.registered].filter((id) => id.startsWith(`matter-${this.nodeKey(p)}-`))
  }

  /** The node's operational id in hex, stable for as long as it stays paired. */
  private nodeKey(p: ClientNode): string {
    const n = p.state.commissioning.peerAddress?.nodeId
    return n !== undefined ? BigInt(n).toString(16).toUpperCase() : p.id
  }

  /** Every useful endpoint of a node, as a snapshot the mapping reads. */
  private endpoints(p: ClientNode): Array<{ snap: EndpointSnapshot; label?: string }> {
    const out: Array<{ snap: EndpointSnapshot; label?: string }> = []
    for (const ep of p.endpoints) {
      if (ep.number === 0) continue
      const clusters: ClusterStates = {}
      for (const id of Object.keys(ep.behaviors.supported)) {
        try {
          clusters[id] = ep.stateOf(id) as Record<string, unknown>
        } catch {
          /* a behavior with no readable state */
        }
      }
      const desc = clusters[DescriptorClient.id] as { deviceTypeList?: Array<{ deviceType: number }> } | undefined
      const snap: EndpointSnapshot = {
        number: ep.number,
        deviceTypes: (desc?.deviceTypeList ?? []).map((t) => Number(t.deviceType)),
        clusters,
      }
      // A bridge (a hub exposing its own devices) names each endpoint.
      const bridged = clusters.bridgedDeviceBasicInformation as { nodeLabel?: string; productName?: string } | undefined
      out.push({ snap, label: bridged?.nodeLabel || bridged?.productName })
    }
    return out
  }

  private report(p: ClientNode): void {
    if (!p.lifecycle.isSeeded) return
    const info = p.stateOf(BasicInformationClient) as {
      nodeLabel?: string
      productName?: string
      vendorName?: string
    }
    const useful = this.endpoints(p)
      .map((e) => ({ ...e, type: widgetTypeOf(e.snap) }))
      .filter((e): e is typeof e & { type: string } => e.type !== null)
    // A device is listed as soon as it is known, and its state reported only
    // while connected: what was read before the connection is not news.
    const reachable = this.connected(p)
    const sameKind = new Set(useful.map((e) => e.type)).size === 1
    for (const e of useful) {
      const id = deviceId(this.nodeKey(p), e.snap.number)
      const telemetry = { ...telemetryOf(e.snap, e.type), reachable: true }
      if (!this.registered.has(id)) {
        this.registered.add(id)
        this.host.registerDevice({
          id,
          name: deviceName(
            info,
            { number: e.snap.number, label: e.label ?? (sameKind ? undefined : partName(e.type, telemetry)) },
            useful.length > 1,
          ),
          widgetType: e.type,
          manufacturer: info.vendorName,
          model: info.productName,
          metrics: metricsOf(telemetry),
          telemetryIntervalSeconds: this.opts.refreshSeconds,
        })
      }
      if (reachable) this.host.reportTelemetry(id, telemetry)
    }
  }
}
