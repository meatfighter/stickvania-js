import type { GameContainer } from "slick2d-ts";
import type { Main } from "../Main.js";
import { registerPlayerActionMain } from "../PlayerActionPolicy.js";
import { StopWatch } from "../StopWatch.js";
import { reconcileStopWatchMusic, resetStopWatchMusicHold } from "../StopWatchMusicHold.js";
import { isAxeKnightShieldSnapshotStateValid } from "./AxeKnightShieldStatePolicy.js";
import type { StickvaniaGameStateSnapshot } from "./GameStateSnapshot.js";
import { isReasonableStickvaniaGameStateSnapshot } from "./GameStateSanity.js";
import { GAME_STATE_STORAGE_KEY, GAME_STATE_VERSION, MAX_GAME_STATE_TEXT_LENGTH } from "./GameStateSchema.js";
import { StickvaniaGameStateSerializer } from "./StickvaniaGameStateSerializer.js";
import { isStopWatchRepeatStateValid } from "./StopWatchRepeatStatePolicy.js";

export type StoredStickvaniaGameStateInspection =
    | { readonly status: "read-failed" }
    | { readonly status: "missing" }
    | { readonly status: "invalid" }
    | { readonly status: "unsupported-future"; readonly version: number }
    | { readonly status: "current"; readonly snapshot: StickvaniaGameStateSnapshot };

export type StickvaniaGameStateWriteResult =
    | { readonly saved: true }
    | {
          readonly saved: false;
          readonly reason:
              | "not-authorized"
              | "invalid-snapshot"
              | "read-failed"
              | "invalid-existing"
              | "unsupported-future"
              | "encode-failed"
              | "too-large"
              | "write-failed";
      };

export class StickvaniaGameStateStore {
    private readonly serializer = new StickvaniaGameStateSerializer();

    public constructor(private readonly appVersion: string) {}

    public save(main: Main, isAuthorized: () => boolean): StickvaniaGameStateWriteResult {
        if (!main.isStateSaveReady()) {
            return { saved: false, reason: "invalid-snapshot" };
        }
        try {
            const snapshot = this.serializer.createSnapshot(main, this.appVersion);
            if (!this.isSnapshotValid(snapshot)) {
                return { saved: false, reason: "invalid-snapshot" };
            }

            const existing = this.inspectStoredGameState();
            switch (existing.status) {
                case "read-failed":
                    return { saved: false, reason: "read-failed" };
                case "invalid":
                    return { saved: false, reason: "invalid-existing" };
                case "unsupported-future":
                    return { saved: false, reason: "unsupported-future" };
                case "missing":
                case "current":
                    break;
            }

            let text: string;
            try {
                text = JSON.stringify(snapshot);
            } catch {
                return { saved: false, reason: "encode-failed" };
            }
            if (text.length > MAX_GAME_STATE_TEXT_LENGTH) {
                return { saved: false, reason: "too-large" };
            }
            if (!isAuthorized()) {
                return { saved: false, reason: "not-authorized" };
            }
            try {
                localStorage.setItem(GAME_STATE_STORAGE_KEY, text);
                return { saved: true };
            } catch (error) {
                console.warn("Unable to save Stickvania game state.", error);
                return { saved: false, reason: "write-failed" };
            }
        } catch (error) {
            console.warn("Unable to save Stickvania game state.", error);
            return { saved: false, reason: "encode-failed" };
        }
    }

    /** Success means every logical game/audio field is already restored. */
    public restore(main: Main, gc: GameContainer): boolean {
        try {
            const stored = this.inspectStoredGameState();
            if (stored.status !== "current" || !this.serializer.isSupportedSnapshotForLoadedResources(main, stored.snapshot)) {
                return false;
            }
            const snapshot = stored.snapshot;
            resetStopWatchMusicHold();
            this.serializer.restoreSnapshot(main, gc, snapshot);
            // Thing restoration can rebuild Simon without running his constructor,
            // so re-register the live Main before resumed input/action processing.
            registerPlayerActionMain(main);
            // timeFrozen is derived from the live StopWatch objects. Recompute
            // once after the complete object graph is restored so a contradictory
            // saved scalar, including a stale nonzero value with no watches,
            // cannot survive restoration.
            StopWatch.recomputeRestoredTimeFrozen(main);
            // Audio restoration is intentionally transport-only. Reconcile once
            // after both gameplay Things and Music have been restored so an
            // active stopwatch is silent before the first resumed simulation tick.
            reconcileStopWatchMusic(main);
            return true;
        } catch (error) {
            console.warn("Unable to restore Stickvania game state.", error);
            return false;
        }
    }

    public hasValidSave(): boolean {
        return this.inspectStoredGameState().status === "current";
    }

    public clear(): boolean {
        try {
            localStorage.removeItem(GAME_STATE_STORAGE_KEY);
            return true;
        } catch (error) {
            console.warn("Unable to clear Stickvania game state.", error);
            return false;
        }
    }

    /** Reads never mutate storage; only an owned Save, New Game, or Reset writes. */
    public inspectStoredGameState(): StoredStickvaniaGameStateInspection {
        let text: string | null;
        try {
            text = localStorage.getItem(GAME_STATE_STORAGE_KEY);
        } catch (error) {
            console.warn("Unable to read Stickvania game state.", error);
            return { status: "read-failed" };
        }
        if (text === null) {
            return { status: "missing" };
        }
        if (text.length > MAX_GAME_STATE_TEXT_LENGTH) {
            return { status: "invalid" };
        }

        let snapshot: unknown;
        try {
            snapshot = JSON.parse(text) as unknown;
        } catch {
            return { status: "invalid" };
        }
        if (snapshot === null || typeof snapshot !== "object" || Array.isArray(snapshot)) {
            return { status: "invalid" };
        }

        const version = Reflect.get(snapshot, "version");
        if (typeof version === "number" && Number.isInteger(version) && version > GAME_STATE_VERSION) {
            return { status: "unsupported-future", version };
        }

        const typedSnapshot = snapshot as StickvaniaGameStateSnapshot;
        return typedSnapshot.version === GAME_STATE_VERSION && this.isSnapshotValid(typedSnapshot)
            ? { status: "current", snapshot: typedSnapshot }
            : { status: "invalid" };
    }

    private isSnapshotValid(snapshot: StickvaniaGameStateSnapshot): boolean {
        return (
            this.serializer.isSupportedSnapshot(snapshot) &&
            isReasonableStickvaniaGameStateSnapshot(snapshot) &&
            isStopWatchRepeatStateValid(snapshot.mainFields) &&
            isAxeKnightShieldSnapshotStateValid(snapshot)
        );
    }
}
