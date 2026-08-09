package stickvania;

import org.newdawn.slick.*;
import org.newdawn.slick.util.*;

public class MedusaBoss extends Thing {

  public static final int STATE_RESTING = 0;
  public static final int STATE_HOVERING = 1;
  public static final int STATE_ATTACKING = 2;
  public static final int STATE_DEAD = 3;
  public static final int STATE_FADE_IN = 4;

  private static final float ATTACK_FRACTION = (float)(1.0 / (91 * 2.0));
  public static final float FADE_FRACTION = 1f / 91f;
  public int fadeIn;

  public int state = STATE_RESTING;
  public int spriteIndex = 0;
  public int spriteIndexIncrementor = 40;
  public int hoveringMoving;
  public int hoveringPause;
  public int spawnDelay;
  public int stunned;
  public float angle;
  public float Y;

  public MedusaBoss(Main main, float x, float y) {
    super(main, 64, 64);
    this.x = x;
    this.Y = this.y = y;

    G = 0;
  }

  @Override
  public boolean update(GameContainer gc) throws SlickException {

    if (state == STATE_HOVERING || state == STATE_ATTACKING) {
      if (--spriteIndexIncrementor == 0) {
        spriteIndexIncrementor = 40;
        if (++spriteIndex == 2) {
          spriteIndex = 0;
        }
      }

      if (moveY(0.5f * (float)FastTrig.cos(angle))) {
        angle += 0.03f;
      }
      if (y < 0) {
        y = 0;
      }      

      if (spawnDelay == 0) {
        spawnDelay = 91 + main.random.nextInt(455);
        main.pushThing(new Snakes(main, x + 12, y + 20,
            main.random.nextBoolean() ? 1 : -1, -4f));
      } else {
        spawnDelay--;
      }

      if (stunned == 0) {
        if (main.intersectsWhip(this) || main.intersectsWeapon(this)) {
          main.pushThing(new Spark(main, this));
          main.playSound(main.boss_hurt);
          stunned = 45;

          main.enemyPower -= 1;
          if (main.enemyPower <= 0) {
            main.enemyPower = 0;
            main.fireSparks(x + 32, y + 8);
            main.killAll();
            main.playSound(main.boss_killed_2);
            main.stopSong();
            main.addPoints(3000);
            state = STATE_DEAD;

            main.pushThing(new Flame(main, x, y + 32, 0, 0, -0.08f, 0, 91));
            main.pushThing(
                new Flame(main, x + 16, y + 64, 0, 0, -0.08f, 0, 91));
            main.pushThing(
                new Flame(main, x + 32, y + 32, 0, 0, -0.08f, 0, 91));

            main.pushThing(new Flame(main, x, y, 0, 0, -0.08f, 30, 91));
            main.pushThing(new Flame(main, x + 16, y, 0, 0, -0.08f, 30, 91));
            main.pushThing(new Flame(main, x + 32, y, 0, 0, -0.08f, 30, 91));

            main.pushThing(
                new Flame(main, x, y + 16, -2f, .5f, -0.09f, 90, 91));
            main.pushThing(
                new Flame(main, x + 8, y + 16, -1f, 1.5f, -0.11f, 90, 91));
            main.pushThing(
                new Flame(main, x + 16, y + 16, 0.25f, 2.5f,  -0.13f, 90, 91));
            main.pushThing(
                new Flame(main, x + 32, y + 16, 1f, 2f, -0.12f, 90, 91));
            main.pushThing(
                new Flame(main, x + 48, y + 16, 2f, 1f, -0.1f, 90, 91));

            main.pushThing(
                new Flame(main, x, y + 16, -2.5f, 0, -0.09f, 60, 91));
            main.pushThing(
                new Flame(main, x + 8, y + 16, -1f, 0, -0.11f, 60, 91));
            main.pushThing(
                new Flame(main, x + 16, y + 16, 0.25f, 0,  -0.13f, 60, 91));
            main.pushThing(
                new Flame(main, x + 32, y + 16, 1f, 0, -0.12f, 60, 91));
            main.pushThing(
                new Flame(main, x + 48, y + 16, 2.5f, 0, -0.1f, 60, 91));

            main.pushThing(new Flame(main, x, y + 32, 0, 0, -0.08f, 120, 91));
            main.pushThing(
                new Flame(main, x + 16, y + 64, 0, 0, -0.08f, 120, 91));
            main.pushThing(
                new Flame(main, x + 32, y + 32, 0, 0, -0.08f, 120, 91));

            main.pushThing(new Flame(main, x, y, 0, 0, -0.08f, 90, 91));
            main.pushThing(new Flame(main, x + 16, y, 0, 0, -0.08f, 90, 91));
            main.pushThing(new Flame(main, x + 32, y, 0, 0, -0.08f, 90, 91));

            main.pushThing(new Orb(main, main.simon.xMin + 240, 96, 273));
          }
        }
      } else {
        stunned--;
      }

      if (main.intersectsSimon(this)) {
        main.hurtSimon(2);
      }
    }

    switch(state) {
      case STATE_RESTING:
        if (main.simon.x - main.simon.xMin < 220) {
          main.killAll();
          main.requestSong(main.boss_2);
          main.simon.xMax = 512;
          state = STATE_FADE_IN;
          spriteIndex = 1;
          vx = main.random.nextBoolean() ? -1 : 1;
          hoveringMoving = main.random.nextInt(182) + 91;
        }
        break;
      case STATE_FADE_IN:
        if (fadeIn < 91) {
          fadeIn++;
        } else {
          state = STATE_HOVERING;
        }
        break;
      case STATE_HOVERING:
        if (hoveringPause > 0) {
          hoveringPause--;
        } else {
          if (!moveX(vx)) {
            vx = -vx;
          }

          if (y > 32) {
            y -= 1;
          } else if (y < 0) {
            y = 0;
          }
          if (--hoveringMoving == 0) {
            hoveringPause = main.random.nextInt(91) + 91;
            hoveringMoving = main.random.nextInt(182) + 91;
            vx = -vx;
            if (main.random.nextBoolean()) {
              float targetX = main.simon.x - 16;
              float targetY = main.simon.y + 8;
              vx = (targetX - x) * ATTACK_FRACTION;
              vy = (targetY - y) * ATTACK_FRACTION;
              state = STATE_ATTACKING;
              break;
            }
          }
        }
        break;
      case STATE_ATTACKING:

        applyGravity();

        if (y < 0) {
          y = 0;
        }
        if (!moveX(vx) || supported) {
          state = STATE_HOVERING;
          vx = main.random.nextBoolean() ? -1 : 1;
          hoveringPause = 0;
        }
        break;
    }

    return true;
  }

  @Override
  public void render(GameContainer gc, Graphics g) throws SlickException {
    if (state != STATE_DEAD) {
      if (fadeIn > 90) {
        main.draw(main.medusaBoss[spriteIndex], x, y);
      } else {
        main.drawFaded(main.medusaBoss[spriteIndex], x, y,
            fadeIn * FADE_FRACTION);
      }
    }
  }
}

