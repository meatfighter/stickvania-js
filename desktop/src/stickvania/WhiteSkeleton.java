package stickvania;

import org.newdawn.slick.*;

public class WhiteSkeleton extends Thing {

  private static final int STATE_INACTIVE = 0;
  private static final int STATE_STANDING = 1;
  private static final int STATE_WALKING = 2;
  private static final int STATE_JUMPING = 3;

  private int direction;
  private int spriteIndex;
  private int spriteIndexIncrementor;
  private int delay;
  private int state = STATE_INACTIVE;
  private float targetX;
  private int throwDelay;
  private int dying;
  private boolean dead;

  public WhiteSkeleton(Main main, float x, float y) {
    super(main, 1, 0, 30, 64);
    this.x = x;
    this.y = y;
    throwDelay = 91 + main.random.nextInt(273);
  }

  @Override
  public boolean update(GameContainer gc) throws SlickException {

    if (dead) {
      if (++dying == 137) {
        if (main.random.nextBoolean()) {
          main.pushThing(main.createCandleItem((int)x, (int)(y + 32),
              main.random.nextBoolean() ? '$' : 'h'));
        }
        main.pushThing(new Flame(main, x, y + 32, 0, 0, -0.05f, 0, 10));
        main.addPoints(300);
        main.playSound(main.wing_flaps);
        return false;
      }
    } else {

      if (main.intersectsSimon(this)) {
        main.hurtSimon(2);
      }

      if (main.intersectsWhip(this) || main.intersectsWeapon(this) || kill) {
        main.pushThing(new Spark(main, this));
        main.playSound(main.crumble_sfx);
        if (supported) {
          dead = true;
        } else {
          if (main.random.nextBoolean()) {
            main.pushThing(main.createCandleItem((int)x, (int)(y + 32),
                main.random.nextBoolean() ? '$' : 'h'));
          }
          main.pushThing(new Flame(main, x, y + 24, 0, 0, -0.08f, 0, 10));
          main.addPoints(300);
          return false;
        }
      } else if (main.timeFrozen == 0) {

        if (main.simon.x + 16 < x) {
          direction = Main.LEFT;
        } else {
          direction = Main.RIGHT;
        }

        applyGravity();

        if (state == STATE_STANDING || state == STATE_WALKING) {
          if (--throwDelay == 0) {
            throwDelay = 91 + main.random.nextInt(273);
            float uy = -6.5f - 3f * main.random.nextFloat();
            float ux = 1f + main.random.nextFloat();
            if (direction == Main.RIGHT) {
              main.pushThing(new Bone(main, x, y + 8, ux, uy));
            } else {
              main.pushThing(new Bone(main, x, y + 8, -ux, uy));
            }
          }
        }

        switch(state) {
          case STATE_INACTIVE:
            if (x >= main.camera - 96 && x <= main.camera + 576) {
              state = STATE_STANDING;
              delay = 23 + main.random.nextInt(46);
            }
            break;
          case STATE_STANDING:
            if (--delay == 0) {
              delay = 91 + main.random.nextInt(273);
              state = STATE_WALKING;
              if (main.simon.x + 16 > x) {
                targetX = main.simon.x - 48 - main.random.nextInt(160);
              } else {
                targetX = main.simon.x + 80 + main.random.nextInt(160);
              }
            }
            break;
          case STATE_WALKING:
            if (--delay == 0) {
              state = STATE_STANDING;
              delay = 23 + main.random.nextInt(46);
            }
            if (++spriteIndexIncrementor == 20) {
              spriteIndexIncrementor = 0;
              if (++spriteIndex == 2) {
                spriteIndex = 0;
              }
            }
            if (Math.abs(x - targetX) < 2) {
              if (main.simon.x + 16 > x) {
                targetX = main.simon.x - 48 - main.random.nextInt(160);
              } else {
                targetX = main.simon.x + 80 + main.random.nextInt(160);
              }
            } else if (x < targetX) {
              if (!moveX(1f)) {
                targetX = x - main.random.nextInt(160);
              } else if (!main.isSupportive((int)(x + 31), (int)(y + 64))) {
                if (main.random.nextInt(5) == 4) {
                  state = STATE_JUMPING;
                  vy = Main.SIMON_JUMP_VELOCITY;
                  vx = 2f;
                } else {
                  targetX = x - main.random.nextInt(160);
                }
              }
            } else {
              if (!moveX(-1f)) {
                targetX = x + main.random.nextInt(160);
              } else if (!main.isSupportive((int)x, (int)(y + 64))) {
                if (main.random.nextBoolean()) {
                  state = STATE_JUMPING;
                  vy = Main.SIMON_JUMP_VELOCITY;
                  vx = -2f;
                } else {
                  targetX = x + main.random.nextInt(160);
                }
              }
            }
            break;
          case STATE_JUMPING:
            if (supported) {
              state = STATE_WALKING;
            } else {
              moveX(vx);
            }
            break;
        }
      }
    }

    return true;
  }

  @Override
  public void render(GameContainer gc, Graphics g) throws SlickException {
    if (dead) {
      if (dying < 30) {
        main.draw(main.crumble[0], x, y + 32);
      } else {
        main.draw(main.crumble[1], x, y + 48);
      }
    } else {
      main.draw(main.skeletons[direction][spriteIndex], x, y);
    }
  }
}
