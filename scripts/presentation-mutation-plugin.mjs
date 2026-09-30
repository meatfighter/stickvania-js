import { replace } from "./counter-test-utils.mjs";
/** Browser-test transforms only; never loaded by the release build. */
export function presentationMutationPlugin(name = process.env.STICKVANIA_PRESENTATION_MUTANT) {
    return {
        name: "presentation-behavioral-counterexample",
        enforce: "pre",
        transform(source, id) {
            const path = id.replaceAll("\\", "/");
            if (name === "full-boundary" && path.endsWith("/persistence/StickvaniaGameStateSerializer.ts"))
                return replace(source, "isPresentationSnapshotValid(snapshot) &&", "");
            if (name === "preflight" && path.endsWith("/persistence/GameStatePreflight.ts"))
                return replace(source, "isPresentationSnapshotValid(snapshot) &&", "");
            if (!path.endsWith("/persistence/PresentationStatePolicy.ts")) return;
            if (name === "weak-credits")
                return replace(
                    source,
                    "export function isCreditsPresentationValid(f: Fields): boolean {",
                    `export function isCreditsPresentationValid(f: Fields): boolean {
            return f.mode !== M.CREDITS || (integer(f.creditsIndex,0,12) && integer(f.recordingIndex,0,728) && (f.creditsIndex !== 12 || f.recordingIndex === 728));`
                );
            if (name === "active-route")
                return replace(
                    source,
                    "function isFadeRouteValid(snapshot: Fields, f: Fields): boolean {",
                    "function isFadeRouteValid(snapshot: Fields, f: Fields): boolean { return true;"
                );
            if (name === "final-advance") {
                source = replace(
                    source,
                    "f.fadeReason === (last ? R.TITLE : R.NEXT_CREDIT)",
                    "(f.fadeReason === R.NEXT_CREDIT || (last && f.fadeReason === R.TITLE))"
                );
                return replace(source, "integer(f.creditsIndex, 0, 11)", "integer(f.creditsIndex, 0, 12)");
            }
            if (name === "ending-owner")
                return replace(
                    source,
                    "export function isEndingAudioStateValid(f: Fields, audio: unknown): boolean {",
                    "export function isEndingAudioStateValid(f: Fields, audio: unknown): boolean { return true;"
                );
        }
    };
}
