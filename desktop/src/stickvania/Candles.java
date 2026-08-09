package stickvania;

import org.newdawn.slick.*;

public class Candles extends Thing {

  public int spriteIndexIncrementor;
  public int spriteIndex;
  public char item;

  public Candles(Main main, int x, int y, char item) {
    super(main, 16, 32);

    this.x = x;
    this.y = y;
    this.item = item;
  }

  @Override
  public boolean update(GameContainer gc) throws SlickException {
    if (++spriteIndexIncrementor == 15) {
      spriteIndexIncrementor = 0;
      if (++spriteIndex == 2) {
        spriteIndex = 0;
      }
    }

    if (main.intersectsWhip(this) || main.intersectsWeapon(this)) {
      main.pushThing(new Spark(main, this));
      main.pushThing(main.createCandleItem((int)(x - 8), (int)y, item));
      main.playSound(main.hit_candle);
      return false;
    }

    return true;
  }

  @Override
  public void render(GameContainer gc, Graphics g) throws SlickException {
    main.draw(main.candles[spriteIndex], x, y);
  }
}
