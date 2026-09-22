import { runSettledBatch } from "slick2d-ts/slick/util/BatchLoader";
import { prepareWithDeadline, ReloadRequiredError, settleRequired } from "./PreparationDeadline.js";
import * as SlickRuntimeModule from "slick2d-ts";
import { getStickvaniaResourceVersion } from "../ResourceVersions.generated.js";
import { STICKVANIA_RESOURCE_REFS } from "../resources.js";

type SlickRuntime = typeof SlickRuntimeModule;
type MainConstructor = typeof import("../stickvania/Main.js").Main;
type StickvaniaBufferedGameConstructor = typeof import("../stickvania/StickvaniaBufferedGame.js").StickvaniaBufferedGame;
type StickvaniaGameStateStoreConstructor = typeof import("../stickvania/persistence/StickvaniaGameStateStore.js").StickvaniaGameStateStore;

export type PreparedRuntime = {
    slick: SlickRuntime;
    Main: MainConstructor;
    StickvaniaBufferedGame: StickvaniaBufferedGameConstructor;
    StickvaniaGameStateStore: StickvaniaGameStateStoreConstructor;
};

const RESOURCE_CACHE_RETRY_COUNT = 3;
const RESOURCE_CACHE_RETRY_DELAY_MS = 250;
const RESOURCE_PRELOAD_CONCURRENCY = 6;
const AUDIO_PRELOAD_CONCURRENCY = 4;
const { ResourceLoader, SoundStore } = SlickRuntimeModule;

export class StickvaniaRuntimeLoader {
    public prepared: PreparedRuntime | null = null;
    public error: unknown = null;
    public progress = 0;
    private pending: Promise<PreparedRuntime> | null = null;
    private controller: AbortController | null = null;
    private reloadFailure: ReloadRequiredError | null = null;
    public constructor(private readonly progressChanged: (progress: number) => void) {}

    private readinessBarrier: Promise<void> | null = null;
    public setReadinessBarrier(barrier: Promise<void> | null): void {
        this.readinessBarrier = barrier;
    }

    public getProgress(): number {
        return this.progress;
    }

    public getPreparedRuntime(): PreparedRuntime | null {
        return this.prepared;
    }

    public hasError(): boolean {
        return this.error !== null;
    }

    public cancelPendingPreparation(): void {
        this.controller?.abort(new DOMException("Preparation cancelled", "AbortError"));
    }

    public async ensurePrepared(forceRetry = false): Promise<PreparedRuntime> {
        if (this.reloadFailure !== null) throw this.reloadFailure;
        if (this.prepared !== null) return this.prepared;
        if (forceRetry && this.pending !== null) {
            this.controller?.abort(new DOMException("Preparation superseded", "AbortError"));
            await this.pending.catch(() => undefined);
            return this.ensurePrepared(true);
        }
        if (this.pending !== null) return this.pending;
        if (!forceRetry && this.error !== null) throw this.error;
        const controller = new AbortController();
        this.controller = controller;
        this.error = null;
        const work = prepareWithDeadline(controller, async () => {
            await this.readinessBarrier;
            controller.signal.throwIfAborted();
            ResourceLoader.clearFailures();
            ResourceLoader.setCacheVersionResolver(getStickvaniaResourceVersion);
            ResourceLoader.setRetryOptions(RESOURCE_CACHE_RETRY_COUNT, RESOURCE_CACHE_RETRY_DELAY_MS);
            this.setProgress(0, controller.signal);
            const [mainModule, bufferedModule, storeModule] = await settleRequired(
                [
                    import("../stickvania/Main.js"),
                    import("../stickvania/StickvaniaBufferedGame.js"),
                    import("../stickvania/persistence/StickvaniaGameStateStore.js")
                ],
                controller
            );
            controller.signal.throwIfAborted();
            await this.preloadResources(STICKVANIA_RESOURCE_REFS, controller);
            controller.signal.throwIfAborted();
            return {
                slick: SlickRuntimeModule,
                Main: mainModule.Main,
                StickvaniaBufferedGame: bufferedModule.StickvaniaBufferedGame,
                StickvaniaGameStateStore: storeModule.StickvaniaGameStateStore
            };
        });
        const pending = work
            .then((runtime) => {
                controller.signal.throwIfAborted();
                if (this.controller !== controller) throw new DOMException("Preparation superseded", "AbortError");
                this.prepared = runtime;
                Reflect.set(window, "__gameResourcesPrepared", true);
                this.setProgress(1, controller.signal);
                return runtime;
            })
            .catch((error: unknown) => {
                if (error instanceof ReloadRequiredError) this.reloadFailure = error;
                if (this.controller === controller) this.error = error;
                throw error;
            })
            .finally(() => {
                if (this.pending === pending) this.pending = null;
                if (this.controller === controller) this.controller = null;
            });
        this.pending = pending;
        return pending;
    }

    private async preloadResources(refs: readonly string[], controller: AbortController): Promise<void> {
        const signal = controller.signal;
        const unique = Array.from(new Set(refs));
        const audio = unique.filter((ref) => ref.toLowerCase().endsWith(".ogg"));
        const resources = unique.filter((ref) => !ref.toLowerCase().endsWith(".ogg"));
        let loaded = 0;
        let failed = false;
        let firstFailure: unknown;
        const runRequired = async (ref: string): Promise<void> => {
            signal.throwIfAborted();
            try {
                if (ref.toLowerCase().endsWith(".ogg")) await SoundStore.get().preloadAudioBuffer(ref, { signal });
                else await ResourceLoader.loadResource(ref, { signal });
                this.setProgress(++loaded / unique.length, signal);
            } catch (error) {
                if (!failed) {
                    failed = true;
                    firstFailure = error;
                    controller.abort(error);
                }
                throw error;
            }
        };
        await Promise.all([
            runSettledBatch(resources, RESOURCE_PRELOAD_CONCURRENCY, runRequired),
            runSettledBatch(audio, AUDIO_PRELOAD_CONCURRENCY, runRequired)
        ]);
        if (failed) throw firstFailure;
        signal.throwIfAborted();
    }

    private setProgress(value: number, signal: AbortSignal): void {
        if (signal.aborted || this.controller?.signal !== signal) return;
        this.progress = value;
        this.progressChanged(value);
    }
}
