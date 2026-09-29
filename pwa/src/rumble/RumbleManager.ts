import { getBrowserRumbleCapability, getConnectedGamepads, playPulseOnGamepad, silenceGamepads } from "./BrowserHaptics.js";
import { getRumbleEffect, type RumbleChannel, type RumbleEffect, type RumbleEffectId, type RumblePulseStep } from "./RumbleEffects.js";
import { rumblePriority, sampleRumble } from "./RumbleTimeline.js";

// Short finite leases bound output if the JS/game loop stalls. No idle polling.
const OUTPUT_LEASE_MS = 20;
type Timer = ReturnType<typeof globalThis.setTimeout>;
export interface RumblePorts {
    now(): number;
    schedule(callback: () => void, delay: number): Timer;
    cancel(timer: Timer): void;
    available(): boolean;
    pads(): Gamepad[];
    play(pad: Gamepad, pulse: RumblePulseStep, current: () => boolean, remaining: () => number): Promise<unknown>;
    silence(pads: readonly Gamepad[], current: () => boolean): Promise<void>;
}
const browserPorts: RumblePorts = {
    now: () => performance.now(),
    schedule: (callback, delay) => globalThis.setTimeout(callback, delay),
    cancel: (timer) => globalThis.clearTimeout(timer),
    available: () => getBrowserRumbleCapability() === "available",
    pads: getConnectedGamepads,
    play: playPulseOnGamepad,
    silence: silenceGamepads
};
type Sequence = {
    readonly effect: RumbleEffect;
    readonly start: number;
    readonly offset: number;
    // Scene clocks are page-lifetime subscriptions, never serialized.
    readonly sceneClock: (() => number | null) | null;
};

export class RumbleManager {
    private enabled: boolean;
    private suspended = false;
    private readonly browserRumbleAvailable: boolean;
    private readonly channels = new Map<RumbleChannel, Sequence>();
    private readonly lastStarted = new Map<RumbleEffectId, number>();
    private timer: Timer | null = null;
    private outputRevision = 0;
    private outputUntil = 0;
    private silenceRevision = 0;
    private silencing = false;

    public constructor(
        enabled: boolean,
        private readonly ports: RumblePorts = browserPorts
    ) {
        this.browserRumbleAvailable = ports.available();
        this.enabled = enabled && this.browserRumbleAvailable;
    }

    public setEnabled(enabled: boolean): void {
        const effective = enabled && this.browserRumbleAvailable;
        if (effective === this.enabled) return;
        this.enabled = effective;
        if (!effective) this.stopAll();
    }

    public isEnabled(): boolean {
        return this.enabled;
    }

    public setSuspended(suspended: boolean): void {
        if (suspended === this.suspended) return;
        this.suspended = suspended;
        if (suspended) this.stopAll();
    }

    public play(id: RumbleEffectId): void {
        this.playFromOffset(id, 0);
    }

    public playFromOffset(id: RumbleEffectId, offsetMs: number): void {
        if (!Number.isFinite(offsetMs)) return;
        this.start(id, Math.max(0, offsetMs), null);
    }

    public playScene(id: RumbleEffectId, readElapsedMs: () => number | null): void {
        this.start(id, 0, readElapsedMs);
    }

    public stop(id: RumbleEffectId): void {
        const channel = getRumbleEffect(id).channel;
        if (this.channels.get(channel)?.effect.id !== id) return;
        this.channels.delete(channel);
        this.outputRevision++; // Retire pending fallbacks before the next render.
        this.requestRender();
    }

    public stopAll(): void {
        this.channels.clear();
        this.clearTimer();
        this.outputRevision++;
        this.beginSilence();
    }

    private elapsed(sequence: Sequence, now: number): number | null {
        try {
            const elapsed = sequence.sceneClock === null ? sequence.offset + now - sequence.start : sequence.sceneClock();
            return elapsed !== null && Number.isFinite(elapsed) && elapsed >= 0 ? elapsed : null;
        } catch {
            return null;
        }
    }

    private prune(now: number): void {
        for (const [channel, sequence] of this.channels) {
            const elapsed = this.elapsed(sequence, now);
            if (elapsed === null || sampleRumble(sequence.effect, elapsed).done) this.channels.delete(channel);
        }
    }

    private start(id: RumbleEffectId, offset: number, sceneClock: (() => number | null) | null): void {
        if (!this.enabled || this.suspended) return;
        const now = this.ports.now();
        this.prune(now);
        const effect = getRumbleEffect(id);
        const rank = rumblePriority(effect);
        const activeRank = Math.max(0, ...Array.from(this.channels.values(), (s) => rumblePriority(s.effect)));
        // Full-lifetime exclusivity. Suppressed feedback is discarded, not replayed later.
        if (activeRank > rank || (activeRank > 0 && rank === 0)) return;
        const last = this.lastStarted.get(id) ?? Number.NEGATIVE_INFINITY;
        if (effect.minIntervalMs !== undefined && now - last < effect.minIntervalMs) return;
        const sequence: Sequence = { effect, start: now, offset, sceneClock };
        const elapsed = this.elapsed(sequence, now);
        if (elapsed === null || sampleRumble(effect, elapsed).done) return;
        this.lastStarted.set(id, now);
        if (rank > 0) this.channels.clear();
        this.channels.set(effect.channel, sequence);
        this.outputRevision++;
        this.requestRender();
    }

    private clearTimer(): void {
        if (this.timer !== null) this.ports.cancel(this.timer);
        this.timer = null;
    }

    private schedule(delay: number): void {
        this.clearTimer();
        this.timer = this.ports.schedule(() => {
            this.timer = null;
            this.render();
        }, delay);
    }

    private requestRender(): void {
        if (!this.enabled || this.suspended) return;
        // Coalesce same-JS-turn producers into one hardware decision.
        this.schedule(0);
    }

    private connected(): Gamepad[] {
        try {
            return this.ports.pads();
        } catch {
            return [];
        }
    }

    private beginSilence(): void {
        this.outputUntil = 0;
        this.silencing = true;
        const revision = ++this.silenceRevision;
        let completed = false;
        const current = (): boolean => !completed && revision === this.silenceRevision;
        let stopped: Promise<void>;
        try {
            stopped = this.ports.silence(this.connected(), current);
        } catch {
            stopped = Promise.resolve();
        }
        // BrowserHaptics already bounds each native silence attempt to 250 ms.
        // New positive commands wait for that bounded stop, but their logical clocks do not.
        void stopped
            .catch(() => {})
            .then(() => {
                if (!current()) return;
                completed = true;
                this.silencing = false;
                if (this.channels.size > 0) this.requestRender();
            });
    }

    private render(): void {
        if (!this.enabled || this.suspended) return;
        const now = this.ports.now();
        this.prune(now);
        if (this.silencing) return; // Completion schedules a sample at the then-current position.
        let strong = 0;
        let weak = 0;
        let duration = OUTPUT_LEASE_MS;
        for (const sequence of this.channels.values()) {
            const elapsed = this.elapsed(sequence, now);
            if (elapsed === null) continue;
            const sample = sampleRumble(sequence.effect, elapsed);
            if (sample.done) continue;
            duration = Math.min(duration, sample.remainingMs);
            if (sample.pulse !== null) {
                // Explicit non-additive mixing; one physical writer per controller.
                strong = Math.max(strong, sample.pulse.strong);
                weak = Math.max(weak, sample.pulse.weak);
            }
        }
        const revision = ++this.outputRevision;
        const until = now + Math.max(1, Math.ceil(duration));
        if (this.channels.size > 0) this.schedule(Math.max(1, Math.ceil(duration)));
        if (strong === 0 && weak === 0) {
            if (this.outputUntil > now) {
                this.clearTimer();
                this.beginSilence();
            }
            return;
        }
        const current = (): boolean => this.enabled && !this.suspended && revision === this.outputRevision && this.ports.now() < until;
        const remaining = (): number => Math.max(0, until - this.ports.now());
        const pads = this.connected();
        this.outputUntil = pads.length > 0 ? until : 0;
        const pulse = { duration: until - now, strong, weak };
        for (const pad of pads) {
            if (!current()) break;
            try {
                void this.ports.play(pad, pulse, current, remaining).catch(() => {});
            } catch {
                /* Optional hardware must not abort other pads or gameplay. */
            }
        }
    }
}
