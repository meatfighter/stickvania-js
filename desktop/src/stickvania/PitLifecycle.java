package stickvania;

public final class PitLifecycle {
  public static final int DESPAWN_Y = 352;

  private PitLifecycle() {}

  public static boolean isDescendingBelowStage(Thing thing) {
    return thing.vy > 0 && thing.y > DESPAWN_Y;
  }
}
