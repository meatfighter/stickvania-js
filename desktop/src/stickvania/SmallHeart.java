package stickvania;

import org.newdawn.slick.*;
import org.newdawn.slick.util.*;

public class SmallHeart extends Thing {

  public static final float FRACTION = 1f / 91f;

  public int X;
  public double angle = 0;
  public int lifeTime = 728;

  public SmallHeart(Main main, int x, int y) {
    super(main, 16, 16);

    this.x = this.X = x;
    this.y = y;
  }

  @Override
  public boolean update(GameContainer gc) throws SlickException {

    if (main.intersectsSimon((int)x, (int)y, 15 + (int)x, 15 + (int)y)) {
      main.addHearts(1);
      main.playSound(main.bleep);
      return false;
    }

    supported = false;

    float targetY = y + 0.5f;

    int y1 = (int)(y + ry2);
    int y2 = (int)(targetY + ry2);

    int x1 = (int)(x + rx1);
    int x2 = (int)(x + rx2);

    for(int i = y1; i <= y2; i++) {
      for(int j = x1; j <= x2; j += 4) {
        if (main.isEmpty(j, i) && main.isSupportive(j, i + 1)) {
          y = i - ry2;
          vy = 0;
          supported = true;

          if (--lifeTime == 0) {
            return false;
          }

          return true;
        }
      }
    }

    y = targetY;

    float targetX = X + 32 * (float)FastTrig.sin(angle);
    if (moveX(targetX - x)) {
      angle += 0.03;
    }

    return true;
  }

  @Override
  public void render(GameContainer gc, Graphics g) throws SlickException {
    if (lifeTime > 90) {
      main.draw(main.smallHeart, x, y);
    } else {
      main.drawFaded(main.smallHeart, x, y, lifeTime * FRACTION);
    }
  }
}

