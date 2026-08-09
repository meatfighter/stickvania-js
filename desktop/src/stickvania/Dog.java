package stickvania;

import org.newdawn.slick.*;

public class Dog extends Thing {

  private final int STATE_RESTING = 0;
  private final int STATE_RUNNING = 1;
  private final int STATE_JUMPING = 2;

  private int state = STATE_RESTING;
  private int direction = Main.LEFT;
  private int spriteIndex = 1;
  private int spriteIndexIncrementor;

  public Dog(Main main, float x, float y) {
    super(main, 64, 32);
    this.x = x;
    this.y = y;
  }

  @Override
  public boolean update(GameContainer gc) throws SlickException {

    if (main.intersectsWhip(this) || main.intersectsWeapon(this) || kill) {
      main.pushThing(new Spark(main, this));
      main.pushThing(new Flame(main, x, y, -1f, 0, -0.08f, 0, 10));
      main.pushThing(new Flame(main, x + 32, y, 1, 0, -0.08f, 0, 10));
      main.addPoints(200);
      main.playSound(main.dog_killed);
      return false;
    }

    if (main.intersectsSimon(this)) {
      main.hurtSimon(2);
    }

    if (main.timeFrozen == 0) {
      if (state == STATE_RESTING) {
        if (Math.abs(main.simon.x - x) < 128) {
          state = STATE_RUNNING;
        }
      } else {

        applyGravity();

        if (state == STATE_RUNNING) {
          if (++spriteIndexIncrementor == 15) {
            spriteIndexIncrementor = 0;
            if (++spriteIndex == 4) {
              spriteIndex = 1;
            }
          }

          if (direction == Main.LEFT) {
            if (!main.isSupportive((int)x, (int)(y + 33))) {
              vy = Main.SIMON_JUMP_VELOCITY;
              state = STATE_JUMPING;
            } else if (!moveX(-3f)) {
              direction = Main.RIGHT;
            }
          } else {
            if (!main.isSupportive((int)(x + 63), (int)(y + 33))) {
              vy = Main.SIMON_JUMP_VELOCITY;
              state = STATE_JUMPING;
            } else if (!moveX(3f)) {
              direction = Main.LEFT;
            }
          }

        } else {

          if (supported) {
            state = STATE_RUNNING;

            if (y > main.simon.y) {
              if (x + 32 > main.simon.x) {
                direction = Main.LEFT;
              } else {
                direction = Main.RIGHT;
              }
            }
          } else {
            if (direction == Main.LEFT) {
              moveX(-3f);
            } else {
              moveX(3f);
            }
          }
        }
      }
    }

    return true;
  }

  @Override
  public void render(GameContainer gc, Graphics g) throws SlickException {
    switch(state) {
      case STATE_RESTING:
        main.draw(main.dogs[direction][0], x, y);
        break;
      case STATE_RUNNING:
        main.draw(main.dogs[direction][spriteIndex], x, y);
        break;
      case STATE_JUMPING:
        main.draw(main.dogs[direction][2], x, y);
        break;
    }
  }
}
