package stickvania;

import org.newdawn.slick.*;

public class Dagger extends Thing {

  public int direction;

  public Dagger(Main main, float x, float y, int direction) {
    super(main, 0, 8, 32, 14);
    this.x = x;
    this.y = y;
    this.direction = direction;
    main.playSound(main.threw_dagger);
  }

  @Override
  public boolean update(GameContainer gc) throws SlickException {
    if (direction == Main.RIGHT) {
      x += 6;
    } else {
      x -= 6;
    }
    if (x < main.camera - 32 || x > main.camera + 512 || intersected) {
      return false;
    }
    return true;
  }

  @Override
  public void render(GameContainer gc, Graphics g) throws SlickException {
    main.draw(main.daggers[direction], x, y);
  }
}
