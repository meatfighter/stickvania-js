package stickvania;

import org.newdawn.slick.*;

public class Sickle extends Thing {

  public static final int STATE_FOWARD = 0;
  public static final int STATE_REVERSING = 1;
  public static final int STATE_REVERSE = 2;
  public static final float G = -0.093257718966603654694391934467333f;

  public int direction;
  public int state;
  public float angle;
  public float g;
  private GrimReaper grimReaper;
  private float targetX;
  public int soundDelay;

  public Sickle(Main main, float x, float y, int direction,
      GrimReaper grimReaper) {
    super(main, 32, 32);
    this.x = x;
    this.y = y;
    this.direction = direction;
    this.state = STATE_FOWARD;
    this.grimReaper = grimReaper;

    if (direction == Main.RIGHT) {
      vx = 2;
      g = G;
      targetX = Math.min(grimReaper.x + 208, main.camera + 448);
    } else {
      vx = -2;
      g = -G;
      targetX = Math.max(grimReaper.x - 128, main.camera + 32);
    }
  }

  @Override
  public boolean update(GameContainer gc) throws SlickException {

    if (soundDelay > 0) {
      soundDelay--;
    } else {
      soundDelay = 20;
      main.playSound(main.spinning);
    }

    if (main.intersectsWhip(this) || main.intersectsWeapon(this) || kill) {
      main.pushThing(new Spark(main, this));
      main.pushThing(new Flame(main, x, y, 0, 0, -0.05f, 0, 10));
      main.addPoints(100);
      main.playSound(main.snuffed);
      grimReaper.sickleGone();
      return false;
    } else if (main.intersectsSimon(this)) {
      main.hurtSimon(1);
    }

    if (main.timeFrozen == 0) {
      switch(state) {
        case STATE_FOWARD:
          if (direction == Main.RIGHT) {
            x += 2;
            angle += 6;
            if (x >= targetX) {
              state = STATE_REVERSING;
            }
          } else {
            x -= 2;
            angle -= 6;
            if (x <= targetX) {
              state = STATE_REVERSING;
            }
          }
          break;
        case STATE_REVERSING:
          vx += g;
          x += vx;
          angle += 3 * vx;
          if (Math.abs(vx) >= 2) {
            state = STATE_REVERSE;
          }
          break;
        case STATE_REVERSE:
          if (direction == Main.RIGHT) {
            x -= 2;
            angle -= 6;
          } else {
            x += 2;
            angle += 6;
          }
          if (!grimReaper.dead && main.intersects(this, grimReaper)) {
            grimReaper.sickleGone();
            return false;
          }
          break;
      }
      if (x < main.camera - 96 || x > main.camera + 576) {
        grimReaper.sickleGone();
        return false;
      }
    }

    return true;
  }

  @Override
  public void render(GameContainer gc, Graphics g) throws SlickException {
    main.draw(main.sickle, x, y, angle);
  }
}
