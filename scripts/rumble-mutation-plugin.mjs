/** Test-only source mutations: never imported by the PWA. */
export function rumbleMutationPlugin(name = process.env.STICKVANIA_RUMBLE_MUTANT) {
    return {
        name: "rumble-behavioral-counterexample",
        enforce: "pre",
        transform(source, id) {
            if (!name) return;
            const path = id.replaceAll("\\", "/");
            let changed = source;
            if (path.endsWith("/rumble/RumbleManager.ts")) {
                if (name === "promise-clock") {
                    changed = changed.replace("if (this.channels.size > 0) this.schedule(Math.max(1, Math.ceil(duration)));", "");
                    changed = changed.replace(
                        "this.ports.play(pad, pulse, current, remaining).catch(() => {})",
                        "this.ports.play(pad, pulse, current, remaining).then(() => this.schedule(Math.max(1, Math.ceil(duration)))).catch(() => {})"
                    );
                }
                if (name === "global-named-stop")
                    changed = changed.replace("public stop(id: RumbleEffectId): void {", "public stop(id: RumbleEffectId): void { this.stopAll(); return;");
                if (name === "early-exclusive-invalidation") changed = changed.replace("const activeRank =", "this.outputRevision++; const activeRank =");
            }
            if (name === "floating-restoration" && path.endsWith("/stickvania/Main.ts"))
                changed = changed.replace("this.castleCrumbleRumbleTicks * CASTLE_TICK_MS", "this.castleCrumbleRumbleTicks * (1000 / 91)");
            if (name === "old-castle-phase" && path.endsWith("/rumble/CastleCrumbleTimeline.ts"))
                changed = changed.replace(
                    "return result;",
                    `const old: RumbleStep[]=[{delay:Math.round(45000/91)}];
          for(let i=0;i<8;i++)old.push({duration:48,strong:.3,weak:.72},{delay:Math.round(15000/91)});
          for(let i=0;i<25;i++)old.push({duration:145,strong:magnitude(.28+.34*i/24),weak:magnitude(.18+.1*Math.sin(i*.9))},{delay:95});
          old.push({duration:320,strong:.88,weak:.48});
          for(let i=0;i<5;i++)old.push({delay:105},{duration:150+i*18,strong:magnitude(.38*(1-i/5)),weak:magnitude(.2*(1-i/5))});return old;`
                );
            if (name === "castle-full-boundary" && path.endsWith("/persistence/StateFieldValuePolicy.ts"))
                changed = changed.replace(" && isCastleTransitionValid(fields)", "");
            if (name === "castle-preflight" && path.endsWith("/persistence/GameStatePreflight.ts"))
                changed = changed.replace("isCastleTransitionValid(mainFieldsValue) &&", "");
            if (path.endsWith("/persistence/CastlePresentationPhasePolicy.ts")) {
                if (name === "castle-pending-tally")
                    changed = changed.replace(
                        "entering && fields.mode === GAME_STATE_MODE_PLAYING && isCompletedFinalTally(fields)",
                        "entering && fields.mode === GAME_STATE_MODE_PLAYING"
                    );
                if (name === "castle-terminal-tick") changed = changed.replace("tick === CASTLE_LAST_ACTIVE_TICK && fields.fadeState", "fields.fadeState");
            }
            if (changed !== source) return changed;
        }
    };
}
