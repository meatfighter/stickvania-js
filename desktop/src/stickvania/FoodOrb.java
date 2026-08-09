package stickvania;

import org.newdawn.slick.*;
import org.newdawn.slick.util.*;

public class FoodOrb extends Thing {

  public static final int STATE_FADE_IN = 0;
  public static final int STATE_FLYING = 1;
  public static final int STATE_SHOOTING = 2;
  
  public static final float FRACTION = 1f / 91f;
  public static final float ANGLE1 = (float)(2 * Math.PI / 3);
  public static final float ANGLE2 = (float)(4 * Math.PI / 3);

  private float angle;
  private float sx0;
  private float sy0;
  private float sx1;
  private float sy1;
  private float sx2;
  private float sy2;
  private int fade;
  private float radius;
  private float X;
  private float Y;
  private float a;
  private float b;
  private int state = STATE_FADE_IN;
  private float flyAngle;
  private int flySteps;
  private int shootDelay;
  private float shootAngleInc;
  private int shots = 16;
  private float shootAngle;
  private int bounces = 10;

  public FoodOrb(Main main, float x, float y) {
    super(main, 32, 32);
    this.x = x;
    this.y = y;
    a = x + 16;
    b = y + 16;
  }

  @Override
  public boolean update(GameContainer gc) throws SlickException {

    if (kill) {
      main.pushThing(new Flame(main, x, y, 0, 0, -0.05f, 0, 10));
      return false;
    }

    switch(state) {
      case STATE_FADE_IN:
        if (++fade == 91) {
          state = STATE_FLYING;
          flySteps = 91;
          float tx = 64;
          float ty = 300;
          if (main.simon.x - 16 > 256) {
            tx = 448;
          }
          vx = (tx - a) * FRACTION;
          vy = (ty - b) * FRACTION;
        }
        break;

      case STATE_FLYING:
        a += vx;
        b += vy;
        x = a + (float)(radius * Math.cos(flyAngle)) - 16;
        y = b + (float)(radius * Math.sin(flyAngle)) - 16;
        if (--flySteps == 0) {
          flySteps = 91;
          float tx = main.random.nextInt(384) + 64;
          float ty = main.random.nextInt(224) + 64;
          if (bounces == 0) {
            return false;
          } else if (--bounces == 0) {
            ty = -128;
          }
          vx = (tx - a) * FRACTION;
          vy = (ty - b) * FRACTION;
        }
        if (radius < 64) {
          radius += 0.5;
        }
        flyAngle -= 0.04;
        if (main.intersectsWhip(this) || main.intersectsWeapon(this)) {
          main.playSound(main.snuffed);
          state = STATE_SHOOTING;
          shootAngle = (float)(0.5 * Math.PI);
          if (main.simon.x + 16 < x) {
            shootAngleInc = -0.39269908169872415480783042290994f;
          } else {
            shootAngleInc = 0.39269908169872415480783042290994f;
          }
        } else if (main.intersectsSimon(this)) {
          main.hurtSimon(2);
        }
        break;

      case STATE_SHOOTING:
        if (shootDelay == 0) {
          shootDelay = 5;
          main.pushThing(new Fireball(main, x - 8, y - 8,
              4 * (float)FastTrig.cos(shootAngle),
              4 * (float)FastTrig.sin(shootAngle)));
          shootAngle += shootAngleInc;
          if (--shots == 0) {
            main.pushThing(
                new DropItem(main, (int)x, (int)y, DropItem.TYPE_MEAT));
            return false;
          }
        } else {
          shootDelay--;
        }
        break;
    }

    angle += 0.05;
    X = x - 16;
    Y = y - 16;
    sx0 = X + 16f * (float)FastTrig.cos(angle);
    sy0 = Y + 16f * (float)FastTrig.sin(angle);
    sx1 = X + 16f * (float)FastTrig.cos(angle + ANGLE1);
    sy1 = Y + 16f * (float)FastTrig.sin(angle + ANGLE1);
    sx2 = X + 16f * (float)FastTrig.cos(angle + ANGLE2);
    sy2 = Y + 16f * (float)FastTrig.sin(angle + ANGLE2);

    return true;
  }

  @Override
  public void render(GameContainer gc, Graphics g) throws SlickException {
    if (state == STATE_FADE_IN) {
      float fadeValue = fade * FRACTION;
      main.drawFaded(main.orb, X, Y, fadeValue);
      main.drawFaded(main.spark, sx0, sy0, fadeValue);
      main.drawFaded(main.spark, sx1, sy1, fadeValue);
      main.drawFaded(main.spark, sx2, sy2, fadeValue);
    } else {
      main.draw(main.orb, X, Y);
      main.draw(main.spark, sx0, sy0);
      main.draw(main.spark, sx1, sy1);
      main.draw(main.spark, sx2, sy2);
    }
  }
}
