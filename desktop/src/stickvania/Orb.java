package stickvania;

import org.newdawn.slick.*;

public class Orb extends Thing {

  public static final float FRACTION = 1f / 91f;
  public int fadeIn;
  public int appearDelay;
  private int soundDelay;

  public Orb(Main main, int x, int y, int appearDelay) {
    super(main, 32, 32);
    this.x = x;
    this.y = y;
    this.appearDelay = appearDelay;
  }

  @Override
  public boolean update(GameContainer gc) throws SlickException {

    if (appearDelay > 0) {
      appearDelay--;
      return true;
    }

    if (fadeIn < 91) {
      fadeIn++;
    } else {

      if (soundDelay > 0) {
        soundDelay--;
      } else {
        soundDelay = 70;
        main.playSound(main.heartbeat);
      }

      applyGravity();

      if (main.intersectsSimon(this)) {
        main.beatStage();        
        return false;
      }
    }

    return true;
  }

  @Override
  public void render(GameContainer gc, Graphics g) throws SlickException {
    if (appearDelay == 0) {
      if (fadeIn > 90) {
        main.draw(main.orb, x, y);
      } else {
        main.drawFaded(main.orb, x, y, fadeIn * FRACTION);
      }
    }
  }
}
