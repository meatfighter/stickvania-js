package stickvania;

import org.newdawn.slick.*;

public class AxeKnight extends Thing {

  private static final int STATE_INACTIVE = 0;
  private static final int STATE_WALKING = 1;
  private static final int STATE_STANDING = 2;

  public int hits = 3;
  public int stunned;
  private int direction;
  private int displayDirection;
  private int spriteIndex;
  private int spriteIndexIncrementor;
  private int standingDelay;
  private int state = STATE_INACTIVE;
  private int walkedDistance;
  private int throwDelay;
  private boolean hasAxe = true;
  public boolean dead;

  public AxeKnight(Main main, float x, float y) {
    super(main, 48, 64);
    this.x = x;
    this.y = y;

    throwDelay = main.random.nextInt(273);
  }

  public void axeGone() {
    hasAxe = true;
    throwDelay = main.random.nextInt(273);
  }

  @Override
  public boolean update(GameContainer gc) throws SlickException {

    if (kill) {
      hits = 0;
      stunned = 0;
    }

    if (stunned > 0) {
      stunned--;
    } else if (main.intersectsWhip(this)
        || main.intersectsWeapon(this) || kill) {
      main.pushThing(new Spark(main, this));
      if (--hits <= 0) {
        if (main.random.nextBoolean()) {
          main.pushThing(main.createCandleItem((int)x, (int)y, 'h'));
        }
        main.pushThing(new Flame(main, x, y + 24, 0, 0, -0.08f, 0, 10));
        main.pushThing(new Flame(main, x + 16, y + 32, 0, 0, -0.08f, 0, 10));
        main.addPoints(500);
        main.playSound(main.killed_4);
        dead = true;
        return false;
      } else {
        main.playSound(main.stunned);
        stunned = 45;
      }
    }

    if (main.intersectsSimon(this)) {
      main.hurtSimon(2);
    }

    if (main.timeFrozen == 0) {

      if (main.simon.x + 8 < x) {
        displayDirection = Main.LEFT;
      } else {
        displayDirection = Main.RIGHT;
      }

      applyGravity();

      if (state != STATE_INACTIVE && hasAxe) {
        if (throwDelay <= 0) {
          throwDelay = main.random.nextInt(273);
          main.pushThing(new BoomerangAxe(
              main, x + 8, 
              main.random.nextBoolean() ? y : y + 32, displayDirection, this));
          hasAxe = false;
        } else {
          throwDelay--;
        }
      }

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
                || !main.isSupportive((int)(x + 47), (int)(y + 64))) {
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
            walkedDistance = main.random.nextInt(43);
            state = STATE_STANDING;
          }
          break;
        case STATE_STANDING:
          if (++standingDelay == 43) {
            standingDelay = main.random.nextInt(43);
            state = STATE_WALKING;
            float distance = main.simon.x + 8 - x;
            float aDist = Math.abs(distance);
            if (aDist < 128) {
              if (distance < 0) {
                direction = Main.RIGHT;
              } else {
                direction = Main.LEFT;
              }
            } else if (aDist > 256) {
              if (distance < 0) {
                direction = Main.LEFT;
              } else {
                direction = Main.RIGHT;
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
    main.draw(main.axeKnights[displayDirection][spriteIndex], x, y);
  }
}
