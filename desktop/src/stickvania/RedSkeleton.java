package stickvania;

import org.newdawn.slick.*;

public class RedSkeleton extends Thing {

  private static final int STATE_INACTIVE = 0;
  private static final int STATE_WALKING = 1;
  private static final int STATE_STANDING = 2;
  private static final int STATE_CRUMBLING = 3;

  private int state = STATE_INACTIVE;
  private int direction;
  private int spriteIndex;
  private int spriteIndexIncrementor;
  private int walkedDistance;
  private int standingDelay;
  private int crumbling;

  public RedSkeleton(Main main, float x, float y) {
    super(main, 1, 0, 30, 64);
    this.x = x;
    this.y = y;

    direction = main.random.nextBoolean() ? Main.LEFT : Main.RIGHT;
  }

  @Override
  public boolean update(GameContainer gc) throws SlickException {

    if (kill) {
      if (main.random.nextBoolean()) {
        main.pushThing(main.createCandleItem((int)x, (int)y, 'h'));
      }
      main.pushThing(new Flame(main, x, y + 24, 0, 0, -0.08f, 0, 10));
      main.addPoints(400);
      return false;
    }

    if (state == STATE_WALKING || state == STATE_STANDING) {
      if (main.intersectsWhip(this) || main.intersectsWeapon(this)) {
        state = STATE_CRUMBLING;
        main.playSound(main.crumble_sfx);
        main.addPoints(400);
      } else if (main.intersectsSimon(this)) {
        main.hurtSimon(2);
      }
    }

    if (main.timeFrozen == 0) {

      applyGravity();

      switch(state) {
        case STATE_INACTIVE:
          if (x >= main.camera - 96 && x <= main.camera + 576) {
            state = STATE_WALKING;
          }
          break;
        case STATE_WALKING:
          if (direction == Main.LEFT) {
            if (!moveX(-.5f) || !main.isSupportive((int)x, (int)(y + 64))) {
              direction = Main.RIGHT;
            }
          } else {
            if (!moveX(.5f)
                || !main.isSupportive((int)(x + 31), (int)(y + 64))) {
              direction = Main.LEFT;
            }
          }

          if (++spriteIndexIncrementor == 20) {
            spriteIndexIncrementor = 0;
            if (++spriteIndex == 2) {
              spriteIndex = 0;
            }
          }

          if (++walkedDistance >= 96) {
            walkedDistance = 0;
            state = STATE_STANDING;
          }
          break;
        case STATE_STANDING:
          if (++standingDelay == 91) {
            standingDelay = 0;
            state = STATE_WALKING;
            if (direction == Main.LEFT) {
              if ((main.simon.x + 16) - x >= 64) {
                direction = Main.RIGHT;
              }
            } else {
              if (x - (main.simon.x + 16) >= 64) {
                direction = Main.LEFT;
              }
            }
          }
          break;
        case STATE_CRUMBLING:
          if (++crumbling >= 273) {
            crumbling = 0;
            state = STATE_WALKING;
            walkedDistance = 0;
            spriteIndexIncrementor = 0;
            spriteIndex = 0;
            standingDelay = 0;
            if (direction == Main.LEFT) {
              if ((main.simon.x + 16) - x >= 64) {
                direction = Main.RIGHT;
              }
            } else {
              if (x - (main.simon.x + 16) >= 64) {
                direction = Main.LEFT;
              }
            }
          }
          break;
      }
    }

    return true;
  }

  @Override
  public void render(GameContainer gc, Graphics g) throws SlickException {
    if (state == STATE_CRUMBLING) {
      if (crumbling < 20 || crumbling > 253) {
        main.draw(main.crumble[0], x, y + 32);
      } else {
        main.draw(main.crumble[1], x, y + 48);
      }
    } else {
      main.draw(main.skeletons[direction][spriteIndex], x, y);
    }
  }
}
