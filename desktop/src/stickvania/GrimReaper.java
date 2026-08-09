package stickvania;

import org.newdawn.slick.*;
import org.newdawn.slick.util.*;

public class GrimReaper extends Thing {

  public static final int STATE_INACTIVE = 0;
  public static final int STATE_FADE_IN = 1;
  public static final int STATE_DEAD = 2;
  public static final int STATE_THROWING = 3;
  public static final int STATE_FLYING = 4;

  public final float FADE_FRACTION;

  public boolean dead;
  public int direction;
  private int state = STATE_INACTIVE;
  private int fadeIn;
  private int fadeTime;
  private int throwDelay;
  private int sickles = 3;
  private int throwCount;
  private float Y;
  private float hoverAngle;
  private float targetX;
  private int flyTime;
  private float angleInc;
  private float startY;
  private float dy;
  private float angle;
  private int stunned;
  private int power = 32;
  private boolean shouldMove;

  public GrimReaper(Main main, float x, float y) {
    super(main, 80, 96);

    y -= 8;
    this.x = x;
    this.y = -97;

    G = 0.05f;

    float t = (float)Math.sqrt(2f * (y - this.y) / G);
    fadeTime = (int)t;
    FADE_FRACTION = 1f / t;
    vy = G * t;
  }

  public void sickleGone() {
    sickles++;
  }

  @Override
  public boolean update(GameContainer gc) throws SlickException {

    direction = main.simon.x - x - 8 < 0 ? Main.LEFT : Main.RIGHT;

    if (state == STATE_THROWING || state == STATE_FLYING) {
      if (stunned <= 0) {
        if (main.intersectsWhip(this) || main.intersectsWeapon(this)) {
          main.pushThing(new Spark(main, this));
          stunned = 45;
          main.playSound(main.boss_hurt);
          shouldMove = true;
          power--;
          main.enemyPower = power >> 1;
          if (power <= 0) {
            main.fireSparks(x + 24, y + 32);
            main.killAll();
            main.playSound(main.boss_killed_1);
            main.stopSong();      
            main.addPoints(7000);
            state = STATE_DEAD;
            main.pushThing(new Orb(main, main.simon.xMin + 240, 96, 546));
            for(int i = 0; i < 4; i++) {
              for(int j = 0; j < 3; j++) {
                if ((i == 0 && j == 0) || (i == 0 && j == 2)
                    || (i == 3 && j == 0) || (i == 3 && j == 2)) {
                  continue;
                }
                main.pushThing(
                    new Flame(main, x + (j << 5) - 16, y + (i << 5) + 16,
                        0, 0, -0.0004f, 0, 455));
              }
            }
            for(int i = 0; i < 4; i++) {
              for(int j = 0; j < 3; j++) {
                if ((i == 0 && j == 0) || (i == 0 && j == 2)
                    || (i == 3 && j == 0) || (i == 3 && j == 2)) {
                  continue;
                }
                main.pushThing(
                    new Flame(main, x + (j << 5), y + (i << 5),
                        0, 0, -0.0002f, 0, 455));
                for(int k = 0; k < 5; k++) {
                  main.pushThing(
                      new Flame(main, x + 8 + main.random.nextInt(64),
                          y + main.random.nextInt(64),
                          main.random.nextFloat() * 4f - 2f,
                          -1f, 0.08f, ((j << 2) + i) * 45 + (k << 2), 35));
                }
              }
            }
          } else if (main.enemyPower == 0) {
            main.enemyPower = 1;
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
      case STATE_INACTIVE:
        if (main.simon.x - main.simon.xMin < 220) {
          main.killAll();
          main.requestSong(main.boss_1);
          main.simon.xMax = 512;
          state = STATE_FADE_IN;
        }
        break;
      case STATE_FADE_IN:
        y += vy;
        vy -= G;
        if (++fadeIn == fadeTime) {
          state = STATE_THROWING;
          fadeIn = fadeTime;
        }
        Y = y;
        break;
      case STATE_THROWING:
        y = Y + 8f * (float)FastTrig.sin(hoverAngle);
        hoverAngle += 0.02;
        if (--throwDelay <= 0) {
          throwDelay = ++throwCount == 3 ? 182 : 23;
          if (throwCount >= 3) {
            throwCount = 0;
            if (shouldMove || main.random.nextInt(3) == 1) {
              shouldMove = false;
              state = STATE_FLYING;
              if (main.random.nextBoolean()) {
                targetX = main.simon.x - 160;
              } else {
                targetX = main.simon.x + 128;
              }
              if (targetX < 64) {
                targetX = 64;
              } else if (targetX > 367) {
                targetX = 367;
              }
              flyTime = (int)Math.abs(targetX - x);

              float targetY = main.simon.y - 40;
              angleInc = (float)(0.5f * Math.PI / flyTime);
              startY = y;
              dy = targetY - y;
              angle = 0;
            }
          }
          if (sickles > 0) {
            sickles--;
            main.pushThing(new Sickle(main, x + 24, 
               y + (main.random.nextInt(3) << 5),
               direction, this));
          }
        }
        break;
      case STATE_FLYING:
        if (--flyTime > 0) {
          if (targetX < x) {
            x -= 1f;
          } else {
            x += 1f;
          }
          angle += angleInc;
          y = startY + dy * (float)FastTrig.sin(angle);
        } else {
          state = STATE_THROWING;
          throwDelay = 0;
          hoverAngle = 0;
          Y = y;
        }
        break;
    }

    return true;
  }

  @Override
  public void render(GameContainer gc, Graphics g) throws SlickException {
    if (state != STATE_DEAD) {
      if (fadeIn >= fadeTime) {
        main.draw(main.grimReaperBoss[direction], x, y);
      } else {
        main.drawFaded(main.grimReaperBoss[direction], x, y,
            fadeIn * FADE_FRACTION);
      }
    }
  }
}
