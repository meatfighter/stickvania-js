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
   * Complete first pit entry before Main's legacy below-pit branch returns. The
   * one-shot boundary is dead==0, not remaining health, so lethal knockback and
   * restored lethal trajectories receive the same presentation. This preflight
   * is intentionally limited to real PLAYING mode so recorded/cinematic mode
   * ordering remains historically unchanged. Main increments dead immediately
   * afterward, making the transition naturally one-shot.
   */
  public static void prepareRegisteredPitDeathPresentation() {
    Main main = registeredMain;
    if (main == null || main.simon == null) {
      return;
    }
    Simon simon = main.simon;
    boolean fadeAllowsGameplay = main.fadeState == Main.FADE_DONE
        || (main.fadeState == Main.FADE_IN && main.fade == 0);
    if (!fadeAllowsGameplay
        || main.mode != Main.MODE_PLAYING
        || main.beatStage
        || main.floorBreaking
        || main.door != null
        || simon.dead != 0
        || simon.y <= 416) {
      return;
    }

    main.playSound(main.simon_in_pit);
    main.requestMusic(main.simon_killed);
    simon.invincible = 0;
    simon.drankPotion = false;
    main.setSimonAlpha(1f);
    main.playerPower = 0;
  }

  /**
   * Preflight Main's countdown immediately before Main evaluates it.
   *
   * Main intentionally owns the actual countdown and StopWatch short-circuit.
   * This helper adds the NES low-time cue, compensates the historical expression
   * order where ++timeIncrementor precedes playerPower/floorBreaking guards, and
   * removes temporary invincibility immediately before a real 1 -> 0 timeout so
   * Main's existing lethal hurt path cannot be rejected by potion/post-hit state.
   * An already-running hurt trajectory is left alone here; Simon.update() makes
   * it lethal after TIME reaches zero without replacing its vx/vy.
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

    if (main.timeIncrementor == 90 && main.time == 1
        && !main.simon.hurt && main.simon.invincible > 0) {
      main.simon.invincible = 0;
      main.simon.drankPotion = false;
      main.setSimonAlpha(1f);
    }

    if (main.timeIncrementor == 90 && main.time > 1 && main.time <= 31) {
      main.playSound(main.twang);
    }
  }

  /**
   * Return whether a delayed Simon attack may still resolve. Hearts and repeat
   * capacity remain separate sub-weapon checks in Main.canUseSubWeapon(). Fades
   * structurally freeze simulation in Main.update(), so an existing action stays
   * valid and its visual pose is preserved while a fade is active. Dracula's
   * final death presentation and the third-stage post-orb brick-break scene are
   * not terminal here: whip and eligible sub-weapons remain usable.
   */
  public static boolean canSimonActionContinue(Main main) {
    Simon simon = main.simon;
    boolean stageThreeFloorBreaking = isStageThreeFloorBreaking(main);
    return (main.mode == Main.MODE_PLAYING
            || main.mode == Main.MODE_DEMO
            || main.mode == Main.MODE_CREDITS)
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
   * Main's fade early-return prevents a fresh attack from actually starting
   * while fading.
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
   * timeout changes that happen before the Attack read. Stage-clear is different:
   * Main suspends Simon before normal gameplay, so an already-active action must
   * remain frozen exactly as it was at orb contact. Fresh actions are still
   * blocked because canSimonActionContinue() treats beatStage as non-playable.
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
    if (main.beatStage) {
      return;
    }
    if (!canSimonActionContinue(main)) {
      cancelSimonAction(main);
    }
  }
}
