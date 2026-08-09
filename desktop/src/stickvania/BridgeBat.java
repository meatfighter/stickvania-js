package stickvania;

import org.newdawn.slick.*;

public class BridgeBat extends Thing {

  public static final int STATE_INACTIVE = 0;
  public static final int STATE_HOVERING = 1;
  public static final int STATE_FLYING = 2;

  private int state = STATE_INACTIVE;
  private int spriteIndex;
  private int spriteIndexIncrementor;
  private float targetX;
  private boolean applyingGravity;
  private int delay;

  public BridgeBat(Main main, float x, float y) {
    super(main, 96, 48);
    this.x = x;
    this.y = y;

    spriteIndex = 1;
  }

  private void findTarget() {
    if (main.simon.x < x + 16) {
      targetX = main.simon.x - 16 - main.random.nextInt(96);
    } else {
      targetX = main.simon.x + 48 + main.random.nextInt(96);
    }
    if (main.random.nextInt(5) < 3) {
      float targetY = main.random.nextInt(5) < 3
          ? main.simon.y + 8 : main.simon.y - 80;
      applyingGravity = true;
      float t = 2 * Math.abs(main.simon.x - x - 16);
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
      main.pushThing(new Flame(main, x, y, -0.9f, 0, -0.06f, 0, 10));
      main.pushThing(new Flame(main, x + 32, y, 0, 0, -0.09f, 0, 10));
      main.pushThing(new Flame(main, x + 64, y, 1, 0, -0.08f, 0, 10));
      main.pushThing(new Flame(main, x, y + 32, 0, 0, 0.05f, 0, 10));
      main.pushThing(new Flame(main, x + 32, y + 32, 0, 0, 0.08f, 0, 10));
      main.pushThing(new Flame(main, x + 64, y + 32, 0, 0, 0.065f, 0, 10));
      main.addPoints(200);
      main.playSound(main.large_bat_killed);
      return false;
    }

    if (main.timeFrozen == 0) {

      if (++spriteIndexIncrementor == 40) {
        spriteIndexIncrementor = 0;
        if (state != STATE_INACTIVE) {
          main.playSound(main.wing_flaps);
        }
        if (++spriteIndex == 3) {
          spriteIndex = 1;
        }
      }

      switch(state) {
        case STATE_INACTIVE:
          if (Math.abs(main.simon.x - x - 16) < 350) {
            state = STATE_HOVERING;
            delay = main.random.nextInt(43);
            spriteIndex = 1;
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
            y += vy;
            vy += G;
            if (y < 0) {
              y = 0;
              applyingGravity = false;
            } else if (y > 303) {
              y = 303;
              applyingGravity = false;
            }
          }
          if (Math.abs(targetX - x) <= 4) {
            state = STATE_HOVERING;
            delay = main.random.nextInt(43);
          } else if (targetX < x) {
            x -= 2f;
          } else {
            x += 2f;
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
    main.draw(main.batBoss[spriteIndex], x, y);
  }
}
