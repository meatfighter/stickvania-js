package stickvania;

import org.newdawn.slick.*;

public class BreakWall extends Thing {

  public char item;
  private int i;
  private int j;

  public BreakWall(Main main, int j, int i, char item) {
    super(main, 32, 32);
    this.i = i;
    this.j = j;
    this.x = j << 5;
    this.y = i << 5;
    this.item = item;
  }

  @Override
  public boolean update(GameContainer gc) throws SlickException {
    if (main.intersectsWhip(this)) {
      main.removeBlock(j, i);
      main.pushThing(new BrickFragment(main, x, y, -1f, -2f));
      main.pushThing(new BrickFragment(main, x + 8, y, 1f, -3f));
      main.pushThing(new BrickFragment(main, x, y + 8, -1f, -4f));
      main.pushThing(new BrickFragment(main, x + 8 + 8, y, 1f, -5f));
      main.pushThing(main.createCandleItem((int)x, (int)y, item));
      main.playSound(main.breaks_wall);
      return false;
    }
    return true;
  }

  @Override
  public void render(GameContainer gc, Graphics g) throws SlickException {
    //main.draw(main.blocks[Main.BLOCK_FULL], x, y);
  }
}
