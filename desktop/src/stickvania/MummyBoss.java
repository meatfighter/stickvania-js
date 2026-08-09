package stickvania;

import org.newdawn.slick.*;

public class MummyBoss extends Thing {

  private static final int[] walkingPattern = { 0, 1, 2, 1 };

  private static final int STATE_RESTING = 0;
  private static final int STATE_STANDING = 1;
  private static final int STATE_WALKING = 2;
  private static final int STATE_DEAD = 3;

  private int direction;
  private int originalDirection;
  private int spriteIndex;
  private int spriteIndexIncrementor;
  private int state = STATE_RESTING;
  private int delay;
  private int shootDelay;
  private float targetX;
  private int stunned;
  private int hits = 16;

  public MummyBoss(Main main, float x, float y, int direction) {
    super(main, 32, 80);
    this.x = x;
    this.y = y;
    this.originalDirection = this.direction = direction;
    shootDelay = 91 + main.random.nextInt(91);
  }

  private void findTarget() {
    if (originalDirection == Main.RIGHT) {
      targetX = main.simon.x + 16 - main.random.nextInt(192);
    } else {
      targetX = main.simon.x + 16 + main.random.nextInt(192);
    }
  }

  @Override
  public boolean moveX(float dx) {
    float target = x + dx;
    if (target < main.simon.xMin) {
      x = main.simon.xMin;
      return false;
    } else if (target > main.simon.xMax) {
      x = main.simon.xMax;
      return false;
    }
    x = target;
    return true;
  }

  @Override
  public boolean update(GameContainer gc) throws SlickException {

    if (state == STATE_STANDING || state == STATE_WALKING) {
      if (main.intersectsSimon(this)) {
        main.hurtSimon(2);
        kill = true;
      }
      
      if (--shootDelay <= 0) {
        shootDelay = 91 + main.random.nextInt(364);
        if (main.simon.x + 16 < x) {
          main.pushThing(new Wrapping(main, x, y + 24, Main.LEFT));
        } else {
          main.pushThing(new Wrapping(main, x, y + 24, Main.RIGHT));
        }
      }

      if (stunned == 0) {
        if (main.intersectsWhip(this) || main.intersectsWeapon(this)) {
          main.pushThing(new Spark(main, this));
          main.playSound(main.boss_hurt);
          stunned = 45;
          hits--;
          if ((hits & 1) == 0) {
            main.enemyPower--;
            if (main.enemyPower <= 0) {
              main.enemyPower = 0;
              main.fireSparks(x, y + 24);              
              main.stopSong();
              main.killAll();
              main.addPoints(3000);
              main.pushThing(new Orb(main, main.simon.xMin + 240, 96, 273));

              main.pushThing(
                  new Flame(main, x - 16, y + 42, -2f, .5f, -0.09f, 90, 91));
              main.pushThing(
                  new Flame(main, x - 8, y + 42, -1f, 1.5f, -0.11f, 90, 91));
              main.pushThing(
                  new Flame(main, x, y + 42, 0.25f, 2.5f,  -0.13f, 90, 91));
              main.pushThing(
                  new Flame(main, x + 8, y + 42, 1f, 2f, -0.12f, 90, 91));
              main.pushThing(
                  new Flame(main, x + 16, y + 42, 2f, 1f, -0.1f, 90, 91));

              main.pushThing(
                  new Flame(main, x - 16, y + 24, -2.5f, 0, -0.09f, 60, 91));
              main.pushThing(
                  new Flame(main, x - 8, y + 16, -1f, 0, -0.11f, 60, 91));
              main.pushThing(
                  new Flame(main, x, y + 24, 0.25f, 0,  -0.13f, 60, 91));
              main.pushThing(
                  new Flame(main, x + 8, y + 16, 1f, 0, -0.12f, 60, 91));
              main.pushThing(
                  new Flame(main, x + 16, y + 24, 2.5f, 0, -0.1f, 60, 91));
            }
          }
          if (hits == 0) {
            state = STATE_DEAD;

            main.playSound(main.boss_killed_3);

            main.pushThing(new Flame(main, x - 16, y + 42, 0, 0, -0.09f, 0, 91));
            main.pushThing(
                new Flame(main, x, y + 42, 0, 0, -0.08f, 0, 91));
            main.pushThing(
                new Flame(main, x + 16, y + 42, 0, 0, -0.1f, 0, 91));

            main.pushThing(new Flame(main, x - 16, y, 0, 0, -0.06f, 30, 91));
            main.pushThing(new Flame(main, x, y, 0, 0, -0.08f, 30, 91));
            main.pushThing(new Flame(main, x + 16, y, 0, 0, -0.09f, 30, 91));

            main.pushThing(new Flame(main, x - 16, y + 32, 0, 0, -0.1f, 15, 91));
            main.pushThing(
                new Flame(main, x, y + 32, 0, 0, -0.06f, 15, 91));
            main.pushThing(
                new Flame(main, x + 16, y + 32, 0, 0, -0.09f, 15, 91));

            main.pushThing(new Flame(main, x - 32, y, 0, 0, 0.03f, 50, 91));
            main.pushThing(new Flame(main, x, y, 0, 0, 0.05f, 50, 91));
            main.pushThing(new Flame(main, x + 32, y, 0, 0, 0.01f, 50, 91));
          }
        }
      } else {
        stunned--;
      }
    }

    switch(state) {
      case STATE_RESTING:
        if (main.simon.xMax - main.simon.x < 250) {
          main.killAll();
          main.requestSong(main.boss_1);
          main.simon.xMin = main.simon.xMax - 512;
          state = STATE_WALKING;
          delay = 91 + main.random.nextInt(364);
          findTarget();
        }
        break;
      case STATE_WALKING:
        if (++spriteIndexIncrementor == 35) {
          spriteIndexIncrementor = 0;
          if (++spriteIndex == 4) {
            spriteIndex = 0;
          }
        }
        if (--delay <= 0) {
          state = STATE_STANDING;
          delay = 43 + main.random.nextInt(91);
          spriteIndexIncrementor = 0;
          spriteIndex = 0;
        }
        if (Math.abs(targetX - x) <= 2) {
          findTarget();
        } else if (targetX < x) {
          direction = Main.LEFT;
          if (!moveX(-1f)) {
            targetX = x + main.random.nextInt(192);
          }
        } else {
          direction = Main.RIGHT;
          if (!moveX(1f)) {
            targetX = x - main.random.nextInt(192);
          }
        }
        break;
      case STATE_STANDING:
        if (--delay <= 0) {
          state = STATE_WALKING;
          delay = 91 + main.random.nextInt(364);
          findTarget();
        }
        break;
    }

    return true;
  }

  @Override
  public void render(GameContainer gc, Graphics g) throws SlickException {
    if (state != STATE_DEAD) {
      main.draw(main.mummyBoss[direction][walkingPattern[spriteIndex]], x, y);
    }
  }
}
