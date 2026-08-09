package stickvania;

import org.newdawn.slick.*;

public class Boomerang extends Thing {

  public static final int STATE_FOWARD = 0;
  public static final int STATE_REVERSING = 1;
  public static final int STATE_REVERSE = 2;
  public static final float G = -0.13988657844990548204158790170132f;

  public int direction;
  public int state;
  public float angle;
  public float g;
  public int soundDelay;

  public Boomerang(Main main, float x, float y, int direction) {
    super(main, 32, 32);
    this.x = x;
    this.y = y;
    this.direction = direction;
    this.state = STATE_FOWARD;
    this.vx = direction == Main.RIGHT ? 3 : -3;
    this.g = direction == Main.RIGHT ? G : -G;
  }

  @Override
  public boolean update(GameContainer gc) throws SlickException {

    if (soundDelay > 0) {
      soundDelay--;
    } else {
      soundDelay = 20;
      main.playSound(main.spinning);
    }

    switch(state) {
      case STATE_FOWARD:        
        if (direction == Main.RIGHT) {
          x += 3;
          angle += 3;
          if (x >= main.camera + 448) {
            state = STATE_REVERSING;
          }
        } else {
          x -= 3;
          angle -= 3;
          if (x <= main.camera + 32) {
            state = STATE_REVERSING;
          }
        }
        break;
      case STATE_REVERSING:
        vx += g;
        x += vx;
        angle += vx;
        if (Math.abs(vx) >= 3) {
          state = STATE_REVERSE;
        }
        break;
      case STATE_REVERSE:        
        if (direction == Main.RIGHT) {
          x -= 3;
          angle -= 3;
        } else {
          x += 3;
          angle += 3;
        }
        if (main.intersectsSimon(this)) {
          return false;
        }
        break;
    }
    if (x < main.camera - 96 || x > main.camera + 576) {
      return false;
    }
    return true;
  }

  @Override
  public void render(GameContainer gc, Graphics g) throws SlickException {
    main.draw(main.boomerang, x, y, angle);
  }
}
