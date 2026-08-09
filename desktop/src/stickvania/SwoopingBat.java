package stickvania;

import org.newdawn.slick.*;
import org.newdawn.slick.util.*;

public class SwoopingBat extends Thing {

  private static final int[] spriteSequence = { 1, 2, 3, 2 };

  private int direction;
  private float angle;
  private float Y;
  private float targetY;
  private int spriteIndex;
  private int spriteDelay;
  private boolean sleeping = true;

  public SwoopingBat(Main main, float x, float y) {
    super(main, 32, 32);
    this.x = x;
    this.y = y;
    this.Y = y;
  }

  @Override
  public boolean update(GameContainer gc) throws SlickException {

    if (main.intersectsWhip(this) || main.intersectsWeapon(this) || kill) {
      main.pushThing(new Spark(main, this));
      main.pushThing(new Flame(main, x, y, 0, 0, -0.05f, 0, 10));
      main.addPoints(200);
      main.playSound(main.bat_killed);
      return false;
    }

    if (main.timeFrozen == 0) {

      if (sleeping) {
        if (Math.abs(main.simon.y - y) < 80
            && Math.abs(main.simon.x - x) < 200) {
          sleeping = false;
          if (x < main.simon.x) {
            direction = Main.RIGHT;
          } else {
            direction = Main.LEFT;
          }
          targetY = main.simon.y + 8;
        }
      } else {

        if (Y < targetY) {
          Y += 1f;
        } else if (Y > targetY) {
          Y -= 1f;
        }

        y = Y + (float)(8 * FastTrig.sin(angle));
        angle += 0.05;

        if (direction == Main.RIGHT) {
          x += 1;
          if (x > main.camera + 576) {
            return false;
          }
        } else {
          x -= 1;
          if (x < main.camera - 64) {
            return false;
          }
        }

        if (spriteDelay == 0) {
          spriteDelay = 10;
          if (spriteIndex == 0) {
            spriteIndex = 3;
          } else {
            spriteIndex--;
          }
        } else {
          spriteDelay--;
        }
      }
    }

    if (main.intersectsSimon(this)) {
      main.hurtSimon(2);
    }

    return true;
  }

  @Override
  public void render(GameContainer gc, Graphics g) throws SlickException {
    if (sleeping) {
      main.draw(main.bats[direction][0], x, y);
    } else {
      main.draw(main.bats[direction][spriteSequence[spriteIndex]], x, y);
    }
  }
}