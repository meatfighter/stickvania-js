import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
const evidence = process.env.QUALIFICATION_EVIDENCE_DIR ?? join(tmpdir(), "stickvania-presentation-evidence");
mkdirSync(evidence, { recursive: true });
const assertions = {
    "floor-restore-profile": "Presentation fresh Main recapture route-floor-breaker",
    "floor-scalar": "Presentation full reader rejects floor-scalar-only",
    "floor-bottom": "Presentation full reader rejects floor-cell-144-10",
    "floor-retirement": "Presentation full reader rejects floor-active-regionThingStack",
    "floor-fractional": "Presentation preflight rejects floor-counter-X-143.5",
    "stair-restore": "Stair resource reader rejects stair-0-0-0-0-x",
    "stair-save": "Outgoing rejects stair-X",
    "full-boundary": "Presentation full reader rejects route-title-timeout",
    preflight: "Presentation preflight rejects route-title-timeout",
    "weak-credits": "Presentation full reader rejects 0-paused-cursor-100",
    "active-route": "Presentation full reader rejects route-title-timeout",
    "final-advance": "Presentation full reader rejects final-card-index-13",
    "ending-owner": "Presentation full reader rejects ending-owner-null"
};
for (const [name, expected] of Object.entries(assertions)) {
    const result = spawnSync(process.execPath, ["scripts/run-presentation-state-verification.mjs"], {
        encoding: "utf8",
        timeout: 300000,
        env: { ...process.env, STICKVANIA_PRESENTATION_MUTANT: name }
    });
    const log = (result.stdout ?? "") + (result.stderr ?? "");
    writeFileSync(join(evidence, "presentation-mutant-" + name + ".log"), log);
    assert(!result.error, "Mutant setup/process failed: " + name + ": " + result.error);
    assert.notEqual(result.status, 0, "Surviving mutant: " + name);
    assert(/AssertionError|ERR_ASSERTION/.test(log) && log.includes(expected), "Must fail intended behavioral assertion: " + name + "\n" + log);
    assert(!/SyntaxError|ReferenceError|Cannot find module|Failed to resolve/.test(log), "Setup failure is not a behavioral red: " + name);
    console.log(name + ": intended behavioral assertion failed");
}
