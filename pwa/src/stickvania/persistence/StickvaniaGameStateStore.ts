import { retainRejectedSave, type RejectedSaveStage } from "./RejectedSaveDebug.js";
import { captureAndWriteSnapshot, removePreference, type SnapshotWriteResult } from "../../app/BrowserPersistence.js";
import type { GameContainer } from "slick2d-ts";
import type { Main } from "../Main.js";
import { registerPlayerActionMain } from "../PlayerActionPolicy.js";
import { StopWatch } from "../StopWatch.js";
import { reconcileStopWatchMusic, resetStopWatchMusicHold } from "../StopWatchMusicHold.js";
import { isAxeKnightShieldSnapshotStateValid } from "./AxeKnightShieldStatePolicy.js";
import type { StickvaniaGameStateSnapshot } from "./GameStateSnapshot.js";
import { isReasonableStickvaniaGameStateSnapshot } from "./GameStateSanity.js";
import { GAME_STATE_STORAGE_KEY, MAX_GAME_STATE_TEXT_LENGTH } from "./GameStateSchema.js";
import { StickvaniaGameStateSerializer } from "./StickvaniaGameStateSerializer.js";
import { isStopWatchRepeatStateValid } from "./StopWatchRepeatStatePolicy.js";

export type StoredStickvaniaGameStateInspection =
    | { readonly status: "read-failed" }
    | { readonly status: "missing" }
    | { readonly status: "invalid" }
    | { readonly status: "current"; readonly snapshot: StickvaniaGameStateSnapshot };

export type StickvaniaGameStateWriteResult = SnapshotWriteResult;

export class StickvaniaGameStateStore {
    private readonly serializer = new StickvaniaGameStateSerializer();

    public constructor(private readonly appVersion: string) {}

    public save(main: Main, isAuthorized: () => boolean): StickvaniaGameStateWriteResult {
        if (!main.isStateSaveReady()) return { saved: false, reason: "invalid-snapshot" };
        return captureAndWriteSnapshot(
            "Stickvania game state",
            GAME_STATE_STORAGE_KEY,
            () => this.serializer.createSnapshot(main, this.appVersion),
            (snapshot) => this.validateOutgoingSnapshot(main, snapshot, isAuthorized),
            MAX_GAME_STATE_TEXT_LENGTH,
            isAuthorized
        );
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
            // Reconstruct the derived counter without repairing invalid authority.
            StopWatch.recomputeRestoredTimeFrozen(main);
            if (main.timeFrozen !== snapshot.mainFields.timeFrozen) {
                throw new Error("Restored StopWatch authority differs from the validated snapshot");
            }
            // Audio restoration is intentionally transport-only. Reconcile once
            // after both gameplay Things and Music have been restored so an
            // active stopwatch is silent before the first resumed simulation tick.
            reconcileStopWatchMusic(main);
            // Thing restoration can rebuild Simon without running his constructor.
            // Publish this Main to input-side action policy only after every
            // potentially-throwing restore/reconciliation step has succeeded.
            registerPlayerActionMain(main);
            return true;
        } catch (error) {
            console.warn("Unable to restore Stickvania game state.", error);
            return false;
        }
    }

    public hasValidSave(): boolean {
        return this.inspectStoredGameState().status === "current";
    }

    public clear(isAuthorized: () => boolean): boolean {
        return removePreference("Stickvania game state", GAME_STATE_STORAGE_KEY, isAuthorized);
    }

    public inspectStoredGameState(): StoredStickvaniaGameStateInspection {
        let text: string | null;
        try {
            text = globalThis.localStorage.getItem(GAME_STATE_STORAGE_KEY);
        } catch {
            return { status: "read-failed" };
        }
        if (text === null) return { status: "missing" };
        if (text.length > MAX_GAME_STATE_TEXT_LENGTH) return { status: "invalid" };
        try {
            const snapshot: unknown = JSON.parse(text);
            return this.isSnapshotValid(snapshot as StickvaniaGameStateSnapshot)
                ? { status: "current", snapshot: snapshot as StickvaniaGameStateSnapshot }
                : { status: "invalid" };
        } catch {
            return { status: "invalid" };
        }
    }

    private validateOutgoingSnapshot(main: Main, snapshot: StickvaniaGameStateSnapshot, isAuthorized: () => boolean): boolean {
        const checks: ReadonlyArray<readonly [RejectedSaveStage, () => boolean]> = [
            ["structure-and-graph", () => this.serializer.isSupportedSnapshot(snapshot)],
            ["values-and-audio", () => isReasonableStickvaniaGameStateSnapshot(snapshot)],
            ["stopwatch-repeat", () => isStopWatchRepeatStateValid(snapshot.mainFields)],
            ["axe-knight-shield", () => isAxeKnightShieldSnapshotStateValid(snapshot)],
            ["presentation-resources", () => this.serializer.isSupportedPresentationResources(main, snapshot)]
        ];
        for (const [stage, check] of checks) {
            let valid: boolean;
            try {
                valid = check();
            } catch (error) {
                retainRejectedSave(snapshot, this.appVersion, { stage, kind: "threw", error }, isAuthorized);
                throw error; // Existing writer reports invalid-snapshot and the original exception.
            }
            if (!valid) {
                retainRejectedSave(snapshot, this.appVersion, { stage, kind: "returned-false" }, isAuthorized);
                return false;
            }
        }
        return true;
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
