package stickvania;

import org.newdawn.slick.*;

public class ShootingSpark extends Thing {

  public ShootingSpark(Main main, float x, float y, float vx, float vy) {
    super(main, 32, 32);

    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
  }

  @Override
  public boolean update(GameContainer gc) throws SlickException {
    x += vx;
    y += vy;

    if (y < -32 || y > 352 || x < main.camera - 32 || x > main.camera + 512) {
      return false;
    }

    return true;
  }

  @Override
  public void render(GameContainer gc, Graphics g) throws SlickException {
    main.draw(main.spark, x, y);
  }
}
