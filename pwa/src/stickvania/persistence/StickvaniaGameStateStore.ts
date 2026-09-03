import type { GameContainer } from "slick2d-ts";
import type { Main } from "../Main.js";
import type { StickvaniaGameStateSnapshot } from "./GameStateSnapshot.js";
import { FIRST_PUBLIC_GAME_STATE_VERSION, GAME_STATE_STORAGE_KEY, GAME_STATE_VERSION } from "./GameStateSchema.js";
import { StickvaniaGameStateSerializer } from "./StickvaniaGameStateSerializer.js";

export class StickvaniaGameStateStore {
    private readonly serializer = new StickvaniaGameStateSerializer();

    public constructor(private readonly appVersion: string) {}

    public save(main: Main): boolean {
        if (!main.isStateSaveReady()) {
            return false;
        }

        try {
            if (this.hasProtectedStoredSnapshot()) {
                return false;
            }
            const snapshot = this.serializer.createSnapshot(main, this.appVersion);
            localStorage.setItem(GAME_STATE_STORAGE_KEY, JSON.stringify(snapshot));
            return true;
        } catch (error) {
            console.warn("Unable to save Stickvania game state.", error);
            return false;
        }
    }

    public restore(main: Main, gc: GameContainer): boolean {
        try {
            const snapshot = this.readSnapshot();
            if (snapshot === null) {
                return false;
            }

            this.serializer.restoreSnapshot(main, gc, snapshot);
            return true;
        } catch (error) {
            console.warn("Unable to restore Stickvania game state.", error);
            return false;
        }
    }

    public hasValidSave(): boolean {
        try {
            return this.readSnapshot() !== null;
        } catch (error) {
            console.warn("Unable to read Stickvania game state.", error);
            return false;
        }
    }

    public cancelPendingRestore(): void {
        this.serializer.cancelPendingRestore();
    }

    public clear(): void {
        try {
            localStorage.removeItem(GAME_STATE_STORAGE_KEY);
        } catch {}
    }

    private readSnapshot(): StickvaniaGameStateSnapshot | null {
        const text = localStorage.getItem(GAME_STATE_STORAGE_KEY);
        if (text === null) {
            return null;
        }

        let snapshot: unknown;
        try {
            snapshot = JSON.parse(text) as unknown;
        } catch {
            this.clear();
            return null;
        }

        if (this.shouldPreserveUnsupportedPublicSnapshot(snapshot)) {
            return null;
        }
        if (snapshot === null || typeof snapshot !== "object" || Array.isArray(snapshot)) {
            this.clear();
            return null;
        }
        const typedSnapshot = snapshot as StickvaniaGameStateSnapshot;
        if (typedSnapshot.version !== GAME_STATE_VERSION || !this.serializer.isSupportedSnapshot(typedSnapshot)) {
            this.clear();
            return null;
        }

        return typedSnapshot;
    }

    private hasProtectedStoredSnapshot(): boolean {
        const text = localStorage.getItem(GAME_STATE_STORAGE_KEY);
        if (text === null) {
            return false;
        }
        try {
            return this.shouldPreserveUnsupportedPublicSnapshot(JSON.parse(text) as unknown);
        } catch {
            return false;
        }
    }

    private shouldPreserveUnsupportedPublicSnapshot(snapshot: unknown): boolean {
        if (snapshot === null || typeof snapshot !== "object" || Array.isArray(snapshot)) {
            return false;
        }
        const version = Reflect.get(snapshot, "version");
        return typeof version === "number" && Number.isInteger(version) && version >= FIRST_PUBLIC_GAME_STATE_VERSION && version !== GAME_STATE_VERSION;
    }
}
