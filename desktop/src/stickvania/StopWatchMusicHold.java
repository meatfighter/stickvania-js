package stickvania;

import org.newdawn.slick.Music;
import org.newdawn.slick.openal.SoundStore;

/** Game-level background-music hold for the StopWatch sub-weapon. */
public final class StopWatchMusicHold {

  private static boolean held;
  private static Main heldMain;
  private static Song pausedSong;
  private static Music pausedStandalone;
  private static Music pendingStandalone;

  private StopWatchMusicHold() {
  }

  private static boolean isSameLiveGame(Main main) {
    return heldMain == main && main.mode == Main.MODE_PLAYING && main.timeFrozen > 0;
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

  private static boolean shouldHold(Main main) {
    return main.mode == Main.MODE_PLAYING
        && main.playerPower > 0
        && main.simon != null
        && main.simon.dead == 0
        && !main.beatStage
        && main.timeFrozen > 0;
  }

  private static void abandonHold() {
    held = false;
    heldMain = null;
    pausedSong = null;
    pausedStandalone = null;
    pendingStandalone = null;
  }

  /** Song uses this to defer a newly selected owner while the stopwatch is active. */
  public static boolean isHeld(Song song) {
    if (held && heldMain != null
        && (!isSameLiveGame(heldMain) || !songBelongsToMain(heldMain, song))) {
      abandonHold();
    }
    return held;
  }

  private static Music findPlayingStandaloneMusic(Main main) {
    Music[] music = {
      main.game_over,
      main.map_1,
      main.map_2,
      main.map_3,
      main.map_4,
      main.prologue,
      main.simon_killed,
      main.stage_cleared,
      main.dracula_dead
    };
    for (int i = 0; i < music.length; i++) {
      if (music[i] != null && music[i].playing()) {
        return music[i];
      }
    }
    return null;
  }

  private static void releaseHold(Main main) {
    Song oldPausedSong = pausedSong;
    Music oldPausedStandalone = pausedStandalone;
    Music oldPendingStandalone = pendingStandalone;

    held = false;
    heldMain = null;
    pausedSong = null;
    pausedStandalone = null;
    pendingStandalone = null;

    if (main.currentSong != null) {
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
      return;
    }

    // requestedSong is the next logical owner even though Main installs it at
    // the beginning of the following frame. Never restart an obsolete paused
    // standalone source while that handoff is pending.
    if (main.requestedSong != null) {
      if (oldPausedStandalone != null && oldPausedStandalone.playing()) {
        oldPausedStandalone.stop();
      }
      return;
    }

    Music playingStandalone = findPlayingStandaloneMusic(main);
    if (playingStandalone != null) {
      if (playingStandalone == oldPausedStandalone
          && SoundStore.get().isMusicPlaying()) {
        SoundStore.get().restartLoop();
      }
      return;
    }

    if (oldPendingStandalone != null) {
      oldPendingStandalone.play();
    }
  }

  /** Reconcile the stopwatch effect with Slick's single dedicated music source. */
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

    if (main.currentSong != null) {
      pendingStandalone = null;
      pausedStandalone = null;
      if (main.currentSong == main.requestedSong
          && main.currentSong.holdForStopWatch()
          && SoundStore.get().isMusicPlaying()) {
        if (pausedSong != main.currentSong) {
          SoundStore.get().pauseLoop();
          pausedSong = main.currentSong;
        }
      }
      return;
    }

    pausedSong = null;
    Music standalone = findPlayingStandaloneMusic(main);
    if (standalone == null || standalone == pendingStandalone) {
      return;
    }
    if (standalone != pausedStandalone
        && SoundStore.get().isMusicPlaying()) {
      SoundStore.get().pauseLoop();
      pausedStandalone = standalone;
      pendingStandalone = null;
    }
  }

  /**
   * Dracula's death cue is the only nonterminal standalone gameplay Music swap.
   * While held, keep the newest owner pending at position zero instead of
   * starting it briefly and immediately pausing the OpenAL music source.
   */
  public static void requestGameplayMusic(Main main, Music music) {
    if (!held || heldMain != main || !shouldHold(main)) {
      main.requestMusic(music);
      return;
    }

    Music old = findPlayingStandaloneMusic(main);
    if (old != null && old != music) {
      old.stop();
    }
    main.stopSong();

    pausedSong = null;
    pausedStandalone = null;
    pendingStandalone = music;
  }
}
