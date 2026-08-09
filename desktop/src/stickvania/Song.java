package stickvania;

import org.newdawn.slick.*;

public class Song {

  private Music intro;
  private Music loop;
  private boolean playing;

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
    playing = false;
  }

  public void play() {
    if (playing) {
      return;
    }
    stop();
    if (intro == null) {
      loop.loop();
    } else {
      intro.play();
    }
    playing = true;
  }

  public void update() {
    if (playing) {
      if ((intro == null || !intro.playing())
          && loop != null && !loop.playing()) {
        loop.loop();
      }
    }
  }
}
