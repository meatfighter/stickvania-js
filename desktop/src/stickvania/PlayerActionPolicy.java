package stickvania;

/** Shared input-side frame and delayed-action policy for live gameplay. */
public final class PlayerActionPolicy {

  private static final float STAIR_TOP_TRANSITION_Y = -62;
  private static final float STAIR_BOTTOM_TRANSITION_Y = 285;
  private static final int LAST_DEATH_SIMULATION_TICK = 473;
  private static Main registeredMain;

  private PlayerActionPolicy() {
  }

  /** Register the live game instance used by input-side frame/action checks. */
  public static void registerPlayerActionMain(Main main) {
    registeredMain = main;
  }

  /** The third-stage post-orb brick-break scene keeps player attacks live at TIME 0. */
  public static boolean isStageThreeFloorBreaking(Main main) {
    return main.stageIndex == 2 && main.floorBreaking;
  }

  /**
   * Return whether Main will reach its ordinary gameplay countdown check after
   * StickvaniaInput.update() returns. Demo uses the same gameplay simulation.
   * Credits are deliberately excluded because their pause decision happens later
   * in Main.update(), and Main.playSound() does not emit gameplay SFX there.
   */
  private static boolean willReachCountdownCheck(Main main) {
    Simon simon = main.simon;
    if (simon == null) {
      return false;
    }

    boolean fadeAllowsGameplay = main.fadeState == Main.FADE_DONE
        || (main.fadeState == Main.FADE_IN && main.fade == 0);
    return fadeAllowsGameplay
        && (main.mode == Main.MODE_PLAYING || main.mode == Main.MODE_DEMO)
        && !main.beatStage
        && simon.dead <= LAST_DEATH_SIMULATION_TICK
        && simon.flashing == 0
        && main.door == null;
  }

  /**
   * Preflight Main's countdown immediately before Main evaluates it.
   *
   * Main intentionally owns the actual countdown and StopWatch short-circuit.
   * This helper adds the NES low-time cue for an imminent real decrement and
   * compensates the historical expression ordering where ++timeIncrementor
   * precedes the playerPower/floorBreaking guards. A temporary -1 phase at an
   * original phase of zero exists only until Main's immediate ++; it is never a
   * stable/rendered/saved state.
   */
  public static void prepareRegisteredCountdownTimer() {
    Main main = registeredMain;
    if (main == null || !willReachCountdownCheck(main) || main.timeFrozen != 0) {
      return;
    }

    if (main.playerPower <= 0 || main.floorBreaking) {
      main.timeIncrementor--;
      return;
    }

    if (main.timeIncrementor == 90 && main.time > 1 && main.time <= 31) {
      main.playSound(main.twang);
    }
  }

  /**
   * Return whether a delayed Simon attack may still resolve. Hearts and repeat
   * capacity remain separate sub-weapon checks in Main.canUseSubWeapon().
   * Dracula's final death presentation and the third-stage post-orb brick-break
   * scene are not terminal here: whip and eligible sub-weapons remain usable.
   */
  public static boolean canSimonActionContinue(Main main) {
    Simon simon = main.simon;
    boolean stageThreeFloorBreaking = isStageThreeFloorBreaking(main);
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
        && (!main.floorBreaking || stageThreeFloorBreaking)
        && (main.time > 0 || stageThreeFloorBreaking)
        && main.door == null;
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
