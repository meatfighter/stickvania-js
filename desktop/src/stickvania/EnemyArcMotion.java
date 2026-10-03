package stickvania;

/** Local emergency policy for Raven/BridgeBat arcs, not shared Thing physics. */
public final class EnemyArcMotion {
  public static final float MAX_VERTICAL_STEP = 32f;
  // For velocity saturated to +/-V, +/-2V is acceleration saturation-equivalent.
  public static final float MAX_ACCELERATION = 2f * MAX_VERTICAL_STEP;

  private EnemyArcMotion() {
  }

  public static float clampVelocity(float velocity) {
    return Math.max(-MAX_VERTICAL_STEP, Math.min(MAX_VERTICAL_STEP, velocity));
  }

  /** Keeps the legacy float expression order and consumes no random values. */
  public static boolean configure(Thing body, float t, float targetY) {
    float h = Math.abs(targetY - body.y);
    float denominator = t * t;
    if (denominator == 0f) {
      body.G = 0f;
      body.vy = 0f;
      return false;
    }

    float acceleration = 2f * h / denominator;
    float velocity = Math.min(4, (float)Math.sqrt(2 * acceleration * h));
    if (targetY > body.y) {
      acceleration = -acceleration;
    } else {
      velocity = -velocity;
    }
    if (Float.isNaN(acceleration) || Float.isInfinite(acceleration)
        || Float.isNaN(velocity) || Float.isInfinite(velocity)) {
      body.G = 0f;
      body.vy = 0f;
      return false;
    }

    body.G = Math.max(-MAX_ACCELERATION, Math.min(MAX_ACCELERATION, acceleration));
    body.vy = velocity;
    return true;
  }
}
