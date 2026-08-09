package stickvania;

import org.newdawn.slick.*;

public class BrickFragment extends Thing {

  public BrickFragment(Main main, float x, float y, float vx, float vy) {
    super(main, 16, 16);
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
  }

  @Override
  public boolean update(GameContainer gc) throws SlickException {
    x += vx;
    y += vy;
    vy += Main.GRAVITY;

    if (y > 352) {
      return false;
    }

    return true;
  }

  @Override
  public void render(GameContainer gc, Graphics g) throws SlickException {
    main.draw(main.brickFragment, x, y);
  }
}
