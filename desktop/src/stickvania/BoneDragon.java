package stickvania;

import org.newdawn.slick.*;
import org.newdawn.slick.util.*;

public class BoneDragon extends Thing {

  private final float A0;
  private final float A1;
  private final float A2;
  private static final float A3 = 1f / (float)(Math.PI / 3);
  private static final float A4 = 360 / (float)(2 * Math.PI);

  private static final float dAngle2 = 0.01f;
  private static final float dAngle3 = 0.03f;
  private static final float dAngle4 = 0.04f;

  private BoneDragonVertebra[] vertebrae = new BoneDragonVertebra[6];
  private boolean active;
  private float radius = 32;
  private char item;
  private float angle;
  private float angle2 = (float)Math.PI;
  private float angle3 = (float)Math.PI;
  private float angle4;
  private float X;
  private float Y;
  private float tx;
  private float ty;
  private int shootDelay;
  private int mouthOpen;
  public int hits = 5;
  public int stunned;
  public boolean dead;
  private int minIndex;
  private int deadDelay = 23;

  public BoneDragon(Main main, float x, float y, char item,
      boolean avoidFloor) {
    super(main, 32, 32);
    this.x = x;
    this.y = y;
    this.item = item;

    X = x + 32;
    Y = y;

    for(int i = 0; i < vertebrae.length; i++) {
      vertebrae[i] = new BoneDragonVertebra(main, x + 16, y);
    }

    if (avoidFloor) {
      A0 = (float)(Math.PI / 12);
      A1 = (float)(Math.PI + Math.PI / 8);
      A2 = (float)(Math.PI / 14);
    } else {
      A0 = (float)(Math.PI / 6);
      A1 = (float)(Math.PI);
      A2 = (float)(Math.PI / 7);
    }
  }

  @Override
  public boolean update(GameContainer gc) throws SlickException {

    if (dead) {
      if (--deadDelay == 0) {
        BoneDragonVertebra vertebra = vertebrae[minIndex];
        deadDelay = 23;
        main.pushThing(main.createCandleItem(
            (int)(vertebra.x - 8), (int)vertebra.y, item));
        main.pushThing(new Flame(main,
            vertebra.x - 8, vertebra.y, 0, 0, -0.05f, 0, 10));
        main.playSound(main.snuffed);
        if (++minIndex == 6) {
          return false;
        }
      }
      return true;
    }

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
        dead = true;
        main.pushThing(main.createCandleItem((int)x, (int)y, item));
        main.pushThing(new Flame(main, x, y, 0, 0, -0.05f, 0, 10));
        main.addPoints(1000);
        main.playSound(main.crumble_sfx);
        return true;
      } else {
        stunned = 45;
        main.playSound(main.stunned);
      }
    }

    if (main.intersectsSimon(this)) {
      main.hurtSimon(2);
    }

    if (main.timeFrozen == 0) {
      if (active) {
        if (mouthOpen > 0) {
          mouthOpen--;
        }

        if (radius < 128f) {
          radius += 1f;
        } else if (shootDelay == 0) {
          shootDelay = 91 + main.random.nextInt(273);
          mouthOpen = 46;
          main.pushThing(new Fireball(main, x + 8, y + 8, -1.5f, 0));
          main.playSound(main.fire_ball_shot);
        } else {
          shootDelay--;
        }

        angle = A1 + A0 * (float)FastTrig.sin(angle2)
            + A2 * (float)FastTrig.sin(angle3);
        angle2 += dAngle2;
        angle3 += dAngle3;

        float angle5 = angle + angle4;
        angle4 += dAngle4;

        float cos = (float)FastTrig.cos(angle);
        float sin = (float)FastTrig.sin(angle);
        float rInc = radius * .125f;
        float r = rInc;
        tx = X + radius * cos;
        ty = Y + radius * sin;

        moveX(tx - x);
        moveY(ty - y);

        float ux = cos;
        float uy = sin;
        float vx = -uy;
        float vy = ux;
        float offset = 12f * (float)FastTrig.sin(angle5);

        float ang = A4 * angle;

        for(int i = 5; i >= 0; i--, r += rInc) {
          BoneDragonVertebra vertebra = vertebrae[i];

          if (main.intersectsSimon(vertebra)) {
            main.hurtSimon(2);
          }

          vertebra.angle = ang;

          float u = r;
          float v = 12f * (float)FastTrig.sin(angle5) - offset;
          angle5 += A3;

          vertebra.tx = X + u * ux + v * vx;
          vertebra.ty = Y + u * uy + v * vy;

          vertebra.moveX(vertebra.tx - vertebra.x);
          vertebra.moveY(vertebra.ty - vertebra.y);
        }
      } else if (Math.abs(main.simon.x - x) < 256f) {
        active = true;
      }
    }

    return true;
  }

  @Override
  public void render(GameContainer gc, Graphics g) throws SlickException {

    if (!dead) {
      main.draw(mouthOpen > 0 ? main.boneDragons[1] : main.boneDragons[0],
          x, y);
    }
    for(int i = 5; i >= minIndex; i--) {
      vertebrae[i].render(gc, g);
    }
  }
}
