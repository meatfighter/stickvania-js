import { getBrowserRumbleCapability, getConnectedGamepads, playPulseOnGamepad, silenceGamepads } from "./BrowserHaptics.js";
import { getRumbleEffect, isRumbleDelayStep, type RumbleChannel, type RumbleEffect, type RumbleEffectId } from "./RumbleEffects.js";

export class RumbleManager {
    private enabled: boolean;
    private suspended: boolean = false;
    private globalToken: number = 0;
    private readonly channelTokens: Map<RumbleChannel, number> = new Map();
    private readonly lastStarted: Map<RumbleEffectId, number> = new Map();
    private readonly browserRumbleAvailable = typeof getBrowserRumbleCapability !== "function" || getBrowserRumbleCapability() === "available";

    public constructor(enabled: boolean) {
        this.enabled = enabled && this.browserRumbleAvailable;
    }

    public setEnabled(enabled: boolean): void {
        const effectiveEnabled = enabled && this.browserRumbleAvailable;
        if (this.enabled == effectiveEnabled) {
            return;
        }
        this.enabled = effectiveEnabled;
        if (!effectiveEnabled) {
            this.stopAll();
        }
    }

    public isEnabled(): boolean {
        return this.enabled;
    }

    public setSuspended(suspended: boolean): void {
        if (this.suspended == suspended) {
            return;
        }
        this.suspended = suspended;
        if (suspended) {
            this.stopAll();
        }
    }

    public play(id: RumbleEffectId): void {
        this.playFromOffset(id, 0);
    }

    public playFromOffset(id: RumbleEffectId, offsetMs: number): void {
        if (!this.enabled || this.suspended) {
            return;
        }

        const effect = getRumbleEffect(id);
        const now = performance.now();
        const lastStarted = this.lastStarted.get(id) ?? Number.NEGATIVE_INFINITY;
        if (effect.minIntervalMs !== undefined && now - lastStarted < effect.minIntervalMs) {
            return;
        }

        this.lastStarted.set(id, now);
        if (effect.exclusive === true) {
            this.cancelAllSequences();
            ignoreHapticFailure(silenceGamepads(getConnectedGamepads()));
        }

        const globalToken = this.globalToken;
        const channelToken = this.nextChannelToken(effect.channel);
        ignoreHapticFailure(this.playSequence(effect, globalToken, channelToken, offsetMs));
    }

    public stop(effectId: RumbleEffectId): void {
        const effect = getRumbleEffect(effectId);
        this.nextChannelToken(effect.channel);
        ignoreHapticFailure(silenceGamepads(getConnectedGamepads()));
    }

    public stopAll(): void {
        this.cancelAllSequences();
        ignoreHapticFailure(silenceGamepads(getConnectedGamepads()));
    }

    private async playSequence(effect: RumbleEffect, globalToken: number, channelToken: number, offsetMs: number): Promise<void> {
        let remainingOffset = Math.max(0, Math.trunc(Number.isFinite(offsetMs) ? offsetMs : 0));
        for (const step of effect.pattern) {
            if (!this.isSequenceCurrent(effect.channel, globalToken, channelToken)) {
                return;
            }
            if (isRumbleDelayStep(step)) {
                if (remainingOffset >= step.delay) {
                    remainingOffset -= step.delay;
                    continue;
                }
                await sleep(step.delay - remainingOffset);
                remainingOffset = 0;
                continue;
            }

            if (remainingOffset >= step.duration) {
                remainingOffset -= step.duration;
                continue;
            }
            const pulse = remainingOffset > 0 ? { ...step, duration: step.duration - remainingOffset } : step;
            remainingOffset = 0;
            const gamepads = getConnectedGamepads();
            await Promise.all(gamepads.map((gamepad) => playPulseOnGamepad(gamepad, pulse)));
        }
    }

    private nextChannelToken(channel: RumbleChannel): number {
        const nextToken = (this.channelTokens.get(channel) ?? 0) + 1;
        this.channelTokens.set(channel, nextToken);
        return nextToken;
    }

    private cancelAllSequences(): void {
        this.globalToken++;
        this.channelTokens.clear();
    }

    private isSequenceCurrent(channel: RumbleChannel, globalToken: number, channelToken: number): boolean {
        return this.enabled && !this.suspended && this.globalToken == globalToken && this.channelTokens.get(channel) == channelToken;
    }
}

function ignoreHapticFailure(promise: Promise<unknown>): void {
    void promise.catch(() => {});
}

function sleep(milliseconds: number): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}
