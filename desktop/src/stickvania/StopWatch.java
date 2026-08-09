package stickvania;

import org.newdawn.slick.*;
import org.newdawn.slick.util.*;

public class StopWatch extends Thing {

  public static final float FRACTION = 1f / 91f;
  public static final float ANGLE1 = (float)(2 * Math.PI / 3);
  public static final float ANGLE2 = (float)(4 * Math.PI / 3);

  public int lifeTime = 455;
  private float angle;
  private float sx0;
  private float sy0;
  private float sx1;
  private float sy1;
  private float sx2;
  private float sy2;
  private int soundDelay;

  public StopWatch(Main main) {
    super(main, 0, -10000, 32, 32);
    main.timeFrozen += 455;
  }

  @Override
  public boolean update(GameContainer gc) throws SlickException {

    if (lifeTime > 0) {
      lifeTime--;
      main.timeFrozen--;
    } else {
      return false;
    }

    if (soundDelay > 0) {
      soundDelay--;
    } else {
      soundDelay = 68;
      main.playSound(main.watch_tick);
    }

    x = main.simon.x + 16;
    y = main.simon.y - 48;

    angle += 0.05;
    sx0 = x + 16f * (float)FastTrig.cos(angle);
    sy0 = y + 16f * (float)FastTrig.sin(angle);
    sx1 = x + 16f * (float)FastTrig.cos(angle + ANGLE1);
    sy1 = y + 16f * (float)FastTrig.sin(angle + ANGLE1);
    sx2 = x + 16f * (float)FastTrig.cos(angle + ANGLE2);
    sy2 = y + 16f * (float)FastTrig.sin(angle + ANGLE2);  

    return true;
  }

  @Override
  public void render(GameContainer gc, Graphics g) throws SlickException {
    if (lifeTime > 90) {
      main.draw(main.dropItems[DropItem.TYPE_STOP_WATCH], x, y);
      main.draw(main.spark, sx0, sy0);
      main.draw(main.spark, sx1, sy1);
      main.draw(main.spark, sx2, sy2);
    } else {
      float fade = lifeTime * FRACTION;
      main.drawFaded(main.dropItems[DropItem.TYPE_STOP_WATCH], x, y, fade);
      main.drawFaded(main.spark, sx0, sy0, fade);
      main.drawFaded(main.spark, sx1, sy1, fade);
      main.drawFaded(main.spark, sx2, sy2, fade);
    }
  }
}
