package stickvania;

import org.newdawn.slick.*;

public class FloatingPoints extends Thing {

  public static final int TYPE_100 = 0;
  public static final int TYPE_400 = 1;
  public static final int TYPE_700 = 2;
  public static final int TYPE_1000 = 3;
  public static final int TYPE_2000 = 4;

  public int type;
  public int count;

  public FloatingPoints(Main main, float x, float y, int type) {
    super(main, 32, 32);
    this.x = x;
    this.y = y;
    this.type = type;
  }

  @Override
  public boolean update(GameContainer gc) throws SlickException {

    y -= 0.25;
    if (++count >= 91) {
      return false;
    }

    return true;
  }
  
  @Override
  public void render(GameContainer gc, Graphics g) throws SlickException {
    main.draw(main.itemPoints[type], x, y);
  }
}
