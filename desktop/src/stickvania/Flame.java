package stickvania;

import org.newdawn.slick.*;

public class Flame extends Thing {

  private static final int STATE_HIDDEN = 0;
  private static final int STATE_FLAME_UP = 1;
  private static final int STATE_FLAMING = 2;
  private static final int STATE_FLAME_DOWN = 3;

  private float g;
  private int appearanceDelay;
  private int lifetime;
  private int state = STATE_HIDDEN;
  private int spriteIndex;
  private int delay = 5;

  public Flame(Main main, float x, float y, float vx, float vy, float g,
      int appearanceDelay, int lifetime) {
    super(main, 32, 32);
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.g = g;
    this.appearanceDelay = appearanceDelay;
    this.lifetime = lifetime;

    if (appearanceDelay == 0) {
      state = STATE_FLAME_UP;
    }
  }

  @Override
  public boolean update(GameContainer gc) throws SlickException {

    if (state != STATE_HIDDEN) {
      x += vx;
      y += vy;
      vy += g;
    }

    switch(state) {
      case STATE_HIDDEN:
        if (--appearanceDelay <= 0) {
          state = STATE_FLAME_UP;
          spriteIndex = 0;
          delay = 5;
        }
        break;
      case STATE_FLAME_UP:
        if (--delay == 0) {
          delay = 5;
          spriteIndex++;
          if (spriteIndex == 3) {
            state = STATE_FLAMING;
            delay = 5;
          }
        }
        break;
      case STATE_FLAMING:
        if (--lifetime == 0) {
          spriteIndex = 3;
          state = STATE_FLAME_DOWN;
          delay = 5;
        } else {
          if (--delay == 0) {
            spriteIndex = (spriteIndex == 3) ? 4 : 3;
            delay = 5;
          }
        }
        break;
      case STATE_FLAME_DOWN:
        if (--delay == 0) {
          delay = 5;
          spriteIndex--;
          if (spriteIndex == -1) {
            spriteIndex = 0;
            return false;
          }
        }
        break;
    }

    return true;
  }

  @Override
  public void render(GameContainer gc, Graphics g) throws SlickException {
    if (state != STATE_HIDDEN) {
      main.draw(main.fires[spriteIndex], x, y);
    }
  }
}
