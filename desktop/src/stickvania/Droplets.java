package stickvania;

import org.newdawn.slick.*;

public class Droplets extends Thing {

  public Droplets(Main main, float x, float y, float vx, float vy) {
    super(main, 16, 32);
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
  }

  @Override
  public boolean update(GameContainer gc) throws SlickException {

    if (vy > 0 && y > 352) {
      return false;
    }

    x += vx;
    y += vy;    

    vy += Main.GRAVITY;

    return true;
  }

  @Override
  public void render(GameContainer gc, Graphics g) throws SlickException {
    main.draw(main.droplets, x, y);
  }
}
