import { javaFloat } from "./JavaMath.js";

/** Local emergency policy for Raven/BridgeBat arcs, not shared Thing physics. */
export const MAX_ENEMY_ARC_VERTICAL_STEP = 32;
// Once velocity is saturated to +/-V, accelerations beyond +/-2V produce
// the same saturated next velocity. Compute launch speed before applying this.
export const MAX_ENEMY_ARC_ACCELERATION = 2 * MAX_ENEMY_ARC_VERTICAL_STEP;

type ArcBody = { y: number; G: number; vy: number };

export function clampEnemyArcVelocity(velocity: number): number {
    return javaFloat(Math.max(-MAX_ENEMY_ARC_VERTICAL_STEP, Math.min(MAX_ENEMY_ARC_VERTICAL_STEP, velocity)));
}

/** Keeps the legacy float32 expression order and consumes no random values. */
export function configureEnemyArc(body: ArcBody, t: number, targetY: number): boolean {
    const h = javaFloat(Math.abs(javaFloat(targetY - body.y)));
    const denominator = javaFloat(t * t);
    if (denominator === 0) {
        body.G = javaFloat(0);
        body.vy = javaFloat(0);
        return false;
    }

    let acceleration = javaFloat(javaFloat(2 * h) / denominator);
    let velocity = Math.min(4, javaFloat(Math.sqrt(javaFloat(javaFloat(2 * acceleration) * h))));
    if (targetY > body.y) {
        acceleration = javaFloat(-acceleration);
    } else {
        velocity = javaFloat(-velocity);
    }
    if (!Number.isFinite(acceleration) || !Number.isFinite(velocity)) {
        body.G = javaFloat(0);
        body.vy = javaFloat(0);
        return false;
    }

    // Preserve the old launch-speed result. Bound only its subsequent arc.
    body.G = javaFloat(Math.max(-MAX_ENEMY_ARC_ACCELERATION, Math.min(MAX_ENEMY_ARC_ACCELERATION, acceleration)));
    body.vy = velocity;
    return true;
}
