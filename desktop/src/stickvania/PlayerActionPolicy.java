package stickvania;

/** Shared terminal-state policy for Simon's delayed whip/sub-weapon actions. */
public final class PlayerActionPolicy {

  private static final float STAIR_TOP_TRANSITION_Y = -62;
  private static final float STAIR_BOTTOM_TRANSITION_Y = 285;
  private static Main registeredMain;

  private PlayerActionPolicy() {
  }

  /** Register the live game instance used by input-side action checks. */
  public static void registerPlayerActionMain(Main main) {
    registeredMain = main;
  }

  /**
   * Return whether a delayed Simon attack may still resolve. Hearts and repeat
   * capacity remain separate sub-weapon checks in Main.canUseSubWeapon().
   */
  public static boolean canSimonActionContinue(Main main) {
    Simon simon = main.simon;
    return (main.mode == Main.MODE_PLAYING
            || main.mode == Main.MODE_DEMO
            || main.mode == Main.MODE_CREDITS)
        && main.fadeState == Main.FADE_DONE
        && main.playerPower > 0
        && simon != null
        && simon.dead == 0
        && !simon.hurt
        && simon.flashing == 0
        && simon.y <= 416
        && !(simon.onStairs
            && (simon.y <= STAIR_TOP_TRANSITION_Y
                || simon.y >= STAIR_BOTTOM_TRANSITION_Y))
        && !main.beatStage
        && !main.floorBreaking
        && main.time > 0
        && main.door == null
        && !(main.stageIndex == 5 && main.enemyPower == 0);
  }

  /**
   * A fresh Attack may start only while general action state is valid. Hearts,
   * repeat capacity, weapon type, and timeFrozen remain Main input concerns.
   */
  public static boolean canRegisteredSimonActionStart() {
    return registeredMain == null || canSimonActionContinue(registeredMain);
  }

  /** Cancel the current delayed attack and require Attack release before reuse. */
  public static void cancelSimonAction(Main main) {
    Simon simon = main.simon;
    if (simon == null || (!simon.whipping && !simon.throwing)) {
      return;
    }
    simon.whipping = false;
    simon.throwing = false;
    simon.whipIncrementor = 0;
    simon.whipIndex = 0;
    simon.releasedWhip = false;
  }

  /**
   * Reconcile immediately before Main advances the attack delay. This covers the
   * on-stairs path where Simon.update() is intentionally skipped and same-tick
   * timeout changes that happen before the Attack read.
   */
  public static void reconcileRegisteredSimonActionBeforeAttackRead() {
    Main main = registeredMain;
    if (main == null) {
      return;
    }
    Simon simon = main.simon;
    if (simon == null || (!simon.whipping && !simon.throwing)) {
      return;
    }
    if (!canSimonActionContinue(main)) {
      cancelSimonAction(main);
    }
  }
}
