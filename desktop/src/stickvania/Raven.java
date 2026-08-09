package stickvania;

import org.newdawn.slick.*;

public class Raven extends Thing {

  private static final int[] spriteSequence = { 0, 1, 2, 1, 3 };

  public static final int STATE_INACTIVE = 0;
  public static final int STATE_HOVERING = 1;
  public static final int STATE_FLYING = 2;

  private int spriteIndex = 4;
  private int spriteIndexIncrementor;
  private int direction;
  private int state = STATE_INACTIVE;
  private int delay;
  private float targetX;
  private boolean applyingGravity;

  public Raven(Main main, float x, float y) {
    super(main, 32, 32);
    this.x = x;
    this.y = y;
  }

  private void findTarget() {
    if (main.simon.x + 16 < x) {
      targetX = main.simon.x + 16 - main.random.nextInt(96);
    } else {
      targetX = main.simon.x + 48 + main.random.nextInt(96);
    }
    if (main.random.nextBoolean()) {
      float targetY = main.random.nextBoolean()
          ? main.simon.y + 8 : main.simon.y - 64;
      applyingGravity = true;
      float t = Math.abs(main.simon.x + 16 - x);
      float h = Math.abs(targetY - y);
      G = 2f * h / (t * t);
      vy = Math.min(4, (float)Math.sqrt(2 * G * h));
      if (targetY > y) {
        G = -G;
      } else {
        vy = -vy;
      }
    } else {
      applyingGravity = false;
    }
  }

  @Override
  public boolean update(GameContainer gc) throws SlickException {

    if (main.intersectsWhip(this) || main.intersectsWeapon(this) || kill) {
      main.pushThing(new Spark(main, this));
      main.pushThing(new Flame(main, x, y, 0, 0, -0.05f, 0, 10));
      main.addPoints(200);
      main.playSound(main.raven_killed);
      return false;
    }

    if (main.timeFrozen == 0) {

      if (main.simon.x + 16 < x) {
        direction = Main.LEFT;
      } else {
        direction = Main.RIGHT;
      }

      if (state != STATE_INACTIVE) {
        if (++spriteIndexIncrementor == 15) {
          spriteIndexIncrementor = 0;
          if (++spriteIndex == 4) {
            spriteIndex = 0;
          }
        }
      }

      switch(state) {
        case STATE_INACTIVE:
          if (Math.abs(main.simon.x + 16 - x) < 192) {
            state = STATE_HOVERING;
            delay = 91 + main.random.nextInt(91);
            spriteIndex = 0;
          }
          break;
        case STATE_HOVERING:
          if (--delay == 0) {
            state = STATE_FLYING;
            findTarget();
          }
          break;
        case STATE_FLYING:
          if (applyingGravity) {
            applyGravity();
            if (y < 0) {
              y = 0;
              applyingGravity = false;
            } else if (y > 320) {
              y = 320;
              applyingGravity = false;
            }
          }
          if (Math.abs(targetX - x) <= 2) {
            state = STATE_HOVERING;
            delay = 91 + main.random.nextInt(91);
          } else if (targetX < x) {
            if (!moveX(-1f)) {
              state = STATE_HOVERING;
              delay = 91 + main.random.nextInt(91);
            }
          } else {
            if (!moveX(1f)) {
              state = STATE_HOVERING;
              delay = 91 + main.random.nextInt(91);
            }
          }
          break;
      }
    }

    if (main.intersectsSimon(this)) {
      main.hurtSimon(2);
    }

    return true;
  }

  @Override
  public void render(GameContainer gc, Graphics g) throws SlickException {
    main.draw(main.ravens[direction][spriteSequence[spriteIndex]], x, y);
  }
}
