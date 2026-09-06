import { ResourceLoader, SoundStore } from "slick2d-ts";
import { getStickvaniaResourceVersion } from "../ResourceVersions.generated.js";
import { STICKVANIA_RESOURCE_REFS } from "../resources.js";

type SlickRuntimeModule = typeof import("slick2d-ts");
type MainConstructor = typeof import("../stickvania/Main.js").Main;
type StickvaniaBufferedGameConstructor = typeof import("../stickvania/StickvaniaBufferedGame.js").StickvaniaBufferedGame;
type StickvaniaGameStateStoreConstructor = typeof import("../stickvania/persistence/StickvaniaGameStateStore.js").StickvaniaGameStateStore;

export type PreparedRuntime = {
    slick: SlickRuntimeModule;
    Main: MainConstructor;
    StickvaniaBufferedGame: StickvaniaBufferedGameConstructor;
    StickvaniaGameStateStore: StickvaniaGameStateStoreConstructor;
};

const RESOURCE_CACHE_RETRY_COUNT = 3;
const RESOURCE_CACHE_RETRY_DELAY_MS = 250;
const RESOURCE_PRELOAD_CONCURRENCY = 6;
const AUDIO_PRELOAD_CONCURRENCY = 4;

export class StickvaniaRuntimeLoader {
    private preparedRuntime: PreparedRuntime | null = null;
    private preparationPromise: Promise<PreparedRuntime> | null = null;
    private preparationError: unknown = null;
    private preparationProgress = 0;
    private preparationGeneration = 0;
    private abortController: AbortController | null = null;
    private readinessBarrier: Promise<void> | null = null;

    public constructor(private readonly onProgress: (progress: number) => void) {}

    public setReadinessBarrier(readinessBarrier: Promise<void> | null): void {
        this.readinessBarrier = readinessBarrier;
    }

    public getProgress(): number {
        return this.preparationProgress;
    }

    public getPreparedRuntime(): PreparedRuntime | null {
        return this.preparedRuntime;
    }

    public hasError(): boolean {
        return this.preparationError !== null;
    }

    public async ensurePrepared(forceRetry = false): Promise<PreparedRuntime> {
        if (this.preparedRuntime !== null) {
            return this.preparedRuntime;
        }
        if (forceRetry && this.preparationPromise !== null) {
            this.abortController?.abort(new Error("Stickvania runtime preparation superseded by retry."));
            try {
                await this.preparationPromise;
            } catch {
                // The replacement preparation below owns the user-visible result.
            }
        }
        if (this.preparationPromise !== null) {
            return this.preparationPromise;
        }
        if (!forceRetry && this.preparationError !== null) {
            throw this.preparationError;
        }

        if (forceRetry) {
            this.preparationError = null;
            this.setProgress(0);
        }
        if (this.readinessBarrier !== null) {
            await this.readinessBarrier.catch(() => undefined);
            if (this.preparationPromise !== null) return this.preparationPromise;
            if (this.preparedRuntime !== null) return this.preparedRuntime;
        }

        ResourceLoader.clearFailures();
        ResourceLoader.setCacheVersionResolver((ref) => getStickvaniaResourceVersion(ref));
        ResourceLoader.setRetryOptions(RESOURCE_CACHE_RETRY_COUNT, RESOURCE_CACHE_RETRY_DELAY_MS);

        const generation = ++this.preparationGeneration;
        const abortController = new AbortController();
        this.abortController = abortController;
        const promise = this.prepareRuntime(generation, abortController.signal)
            .then((runtime) => {
                if (generation !== this.preparationGeneration) {
                    throw new Error("Stickvania runtime preparation was superseded.");
                }
                this.preparedRuntime = runtime;
                Reflect.set(window, "__gameResourcesPrepared", true);
                this.preparationError = null;
                this.setProgress(1);
                return runtime;
            })
            .catch((error) => {
                if (generation === this.preparationGeneration && !abortController.signal.aborted) {
                    this.preparationError = error;
                }
                throw error;
            })
            .finally(() => {
                if (generation === this.preparationGeneration) {
                    this.preparationPromise = null;
                    this.abortController = null;
                }
            });
        this.preparationPromise = promise;
        return promise;
    }

    public cancelPendingPreparation(): void {
        if (this.preparationPromise === null) {
            return;
        }
        this.preparationGeneration++;
        this.abortController?.abort(new Error("Stickvania runtime preparation cancelled."));
        this.abortController = null;
        this.preparationPromise = null;
    }

    private async prepareRuntime(generation: number, signal: AbortSignal): Promise<PreparedRuntime> {
        const [slick, mainModule, bufferedGameModule, gameStateStoreModule] = await Promise.all([
            import("slick2d-ts"),
            import("../stickvania/Main.js"),
            import("../stickvania/StickvaniaBufferedGame.js"),
            import("../stickvania/persistence/StickvaniaGameStateStore.js")
        ]);
        if (generation !== this.preparationGeneration) {
            throw new Error("Stickvania runtime preparation was superseded.");
        }
        await this.preloadResources(STICKVANIA_RESOURCE_REFS, signal);
        return {
            slick,
            Main: mainModule.Main,
            StickvaniaBufferedGame: bufferedGameModule.StickvaniaBufferedGame,
            StickvaniaGameStateStore: gameStateStoreModule.StickvaniaGameStateStore
        };
    }

    private async preloadResources(resourceRefs: readonly string[], signal: AbortSignal): Promise<void> {
        const audioRefs = resourceRefs.filter(isAudioResourceRef);
        const nonAudioRefs = resourceRefs.filter((ref) => !isAudioResourceRef(ref));
        const total = audioRefs.length + nonAudioRefs.length;
        let audioLoaded = 0;
        let nonAudioLoaded = 0;
        const updateProgress = () => this.setProgress(total === 0 ? 1 : (audioLoaded + nonAudioLoaded) / total);
        updateProgress();

        const results = await Promise.allSettled([
            ResourceLoader.preloadResources(nonAudioRefs, {
                signal,
                concurrency: RESOURCE_PRELOAD_CONCURRENCY,
                onProgress: (progress) => {
                    nonAudioLoaded = progress.loaded;
                    updateProgress();
                }
            }),
            SoundStore.get().preloadAudioBuffers(audioRefs, {
                signal,
                concurrency: AUDIO_PRELOAD_CONCURRENCY,
                onProgress: (progress) => {
                    audioLoaded = progress.loaded;
                    updateProgress();
                }
            })
        ]);
        const failure = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
        if (failure !== undefined) {
            throw failure.reason;
        }
        if (signal.aborted) {
            throw signal.reason ?? new Error("Stickvania runtime preparation was aborted.");
        }
        this.setProgress(1);
    }

    private setProgress(progress: number): void {
        this.preparationProgress = Math.max(0, Math.min(1, progress));
        this.onProgress(this.preparationProgress);
    }
}

function isAudioResourceRef(ref: string): boolean {
    return ref.toLowerCase().endsWith(".ogg");
}
