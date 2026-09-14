package stickvania;

import org.newdawn.slick.openal.SoundStore;

/** Game-level background-music hold for the StopWatch sub-weapon. */
public final class StopWatchMusicHold {

  private static boolean held;
  private static Main heldMain;
  private static Song pausedSong;

  private StopWatchMusicHold() {
  }

  /**
   * Return whether the stopwatch is still a valid simulation effect. Demo and
   * credits recordings historically run the gameplay simulation and may use the
   * stopwatch, but only real MODE_PLAYING gameplay is allowed to hold BGM.
   */
  public static boolean canStopWatchRun(Main main) {
    return (main.mode == Main.MODE_PLAYING
            || main.mode == Main.MODE_DEMO
            || main.mode == Main.MODE_CREDITS)
        && main.playerPower > 0
        && main.simon != null
        && main.simon.dead == 0
        && !main.beatStage
        && !main.floorBreaking
        && main.time > 0
        && !(main.stageIndex == 5 && main.enemyPower == 0);
  }

  /** A new stopwatch may start only when the delayed action and stopwatch are both valid. */
  static boolean canStartStopWatch(Main main) {
    return PlayerActionPolicy.canSimonActionContinue(main)
        && canStopWatchRun(main)
        && main.timeFrozen == 0;
  }

  private static boolean shouldHold(Main main) {
    return main.mode == Main.MODE_PLAYING
        && canStopWatchRun(main)
        && main.timeFrozen > 0;
  }

  private static boolean songBelongsToMain(Main main, Song song) {
    return main.boss_1 == song
        || main.boss_2 == song
        || main.ending == song
        || main.stage_1_1 == song
        || main.stage_1_2 == song
        || main.stage_2_1 == song
        || main.stage_3_1 == song
        || main.stage_4_1 == song
        || main.stage_4_2 == song
        || main.stage_5_1 == song
        || main.stage_6_1 == song
        || main.stage_6_2 == song;
  }

  private static void abandonHold() {
    held = false;
    heldMain = null;
    pausedSong = null;
  }

  /** Song uses this to defer a newly selected owner while the stopwatch is active. */
  public static boolean isHeld(Song song) {
    if (held && heldMain != null
        && (!shouldHold(heldMain) || !songBelongsToMain(heldMain, song))) {
      abandonHold();
    }
    return held;
  }

  private static void releaseHold(Main main) {
    Song oldPausedSong = pausedSong;

    held = false;
    heldMain = null;
    pausedSong = null;

    if (main.currentSong == null) {
      return;
    }

    if (main.currentSong == main.requestedSong) {
      if (main.currentSong.isStopWatchPendingStart()) {
        main.currentSong.releaseStopWatchHold();
      } else if (main.currentSong == oldPausedSong) {
        // isMusicPlaying() treats the PAUSED source as active but is false if
        // an intro physically ended before Slick polled Music.playing().
        if (SoundStore.get().isMusicPlaying()) {
          SoundStore.get().restartLoop();
        }
        main.currentSong.releaseStopWatchHold();
      } else {
        main.currentSong.releaseStopWatchHold();
      }
    } else {
      main.currentSong.cancelStopWatchHold();
    }
  }

  /**
   * Reconcile the stopwatch effect with the current gameplay Song. Standalone
   * Music is intentionally never paused: Stickvania uses it only for scripted
   * transition/death/presentation cues whose timelines keep advancing.
   */
  public static void reconcile(Main main) {
    if (!shouldHold(main)) {
      if (held && heldMain == main) {
        releaseHold(main);
      }
      return;
    }

    if (!held || heldMain != main) {
      abandonHold();
      held = true;
      heldMain = main;
    }

    if (main.currentSong != null
        && main.currentSong == main.requestedSong
        && main.currentSong.holdForStopWatch()
        && SoundStore.get().isMusicPlaying()) {
      if (pausedSong != main.currentSong) {
        SoundStore.get().pauseLoop();
        pausedSong = main.currentSong;
      }
    }
  }
}
