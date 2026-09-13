package stickvania;

import org.newdawn.slick.*;

public class Song {

  private Music intro;
  private Music loop;
  private boolean playing;
  private boolean stopWatchPendingStart;

  public Song(String intro) throws SlickException {
    this.intro = new Music(intro);
  }

  public Song(String intro, String loop) throws SlickException {
    if (intro != null) {
      this.intro = new Music(intro);
    }
    this.loop = new Music(loop);
  }

  public void stop() {
    if (intro != null && intro.playing()) {
      intro.stop();
    }
    if (loop != null && loop.playing()) {
      loop.stop();
    }
    stopWatchPendingStart = false;
    playing = false;
  }

  private boolean startFirstPart() {
    if (intro != null) {
      intro.play();
      return true;
    }
    if (loop != null) {
      loop.loop();
      return true;
    }
    return false;
  }

  public void play() {
    if (playing) {
      return;
    }
    stop();
    playing = true;
    if (StopWatchMusicHold.isHeld(this)) {
      stopWatchPendingStart = true;
      return;
    }
    if (!startFirstPart()) {
      playing = false;
    }
  }

  public void update() {
    if (StopWatchMusicHold.isHeld(this) || stopWatchPendingStart || !playing) {
      return;
    }
    if ((intro == null || !intro.playing())
        && loop != null && !loop.playing()) {
      loop.loop();
    }
  }

  /** Return true only when Slick currently owns an active Music source. */
  public boolean holdForStopWatch() {
    if (stopWatchPendingStart) {
      return false;
    }
    if (!playing) {
      playing = true;
      stopWatchPendingStart = true;
      return false;
    }
    return (intro != null && intro.playing())
        || (loop != null && loop.playing());
  }

  public boolean isStopWatchPendingStart() {
    return stopWatchPendingStart;
  }

  public void releaseStopWatchHold() {
    if (!stopWatchPendingStart) {
      return;
    }
    stopWatchPendingStart = false;
    if (!startFirstPart()) {
      playing = false;
    }
  }

  public void cancelStopWatchHold() {
    stopWatchPendingStart = false;
  }
}
