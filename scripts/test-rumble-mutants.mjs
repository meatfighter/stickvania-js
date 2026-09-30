import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
const out = process.env.QUALIFICATION_EVIDENCE_DIR ?? join(tmpdir(), "stickvania-rumble-evidence");
mkdirSync(out, { recursive: true });
for (const name of [
    "promise-clock",
    "global-named-stop",
    "early-exclusive-invalidation",
    "old-castle-phase",
    "floating-restoration",
    "castle-full-boundary",
    "castle-preflight",
    "castle-pending-tally",
    "castle-terminal-tick"
]) {
    const browser = ["floating-restoration", "castle-full-boundary", "castle-preflight"].includes(name);
    const focused = name === "castle-pending-tally" || name === "castle-terminal-tick";
    const result = spawnSync(
        process.execPath,
        browser
            ? ["scripts/run-rumble-castle-qualification.mjs"]
            : ["--test", focused ? "scripts/test-castle-transition-policy.mjs" : "scripts/test-rumble-timeline.mjs"],
        {
            encoding: "utf8",
            timeout: 300000,
            env: { ...process.env, STICKVANIA_RUMBLE_MUTANT: name }
        }
    );
    const log = (result.stdout ?? "") + (result.stderr ?? "");
    writeFileSync(join(out, "mutant-" + name + ".log"), log);
    assert(!result.error, "Mutant process/setup failed: " + name + ": " + result.error);
    assert.notEqual(result.status, 0, "Survived: " + name);
    assert(/AssertionError|ERR_ASSERTION/.test(log), "Must be a behavioral assertion: " + name);
    assert(!/SyntaxError|ReferenceError|Cannot find module|Unexpected.*import/.test(log), "Setup error is not a red: " + name);
    const expected = {
        "castle-full-boundary": "Reject stale pending castle song",
        "castle-preflight": "Reject stale pending castle song",
        "castle-pending-tally": "pending entry stageIndex",
        "castle-terminal-tick": "Only DONE/0/SHOW_CASTLE_FALLS is valid mid-fall"
    }[name];
    if (expected) assert(log.includes(expected), "Must fail the intended phase assertion: " + name);
    console.log(name + ": behavioral counterexample rejected");
}
