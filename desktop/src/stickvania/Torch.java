package stickvania;

import org.newdawn.slick.*;

public class Torch extends Thing {

  public int spriteIndexIncrementor;
  public int spriteIndex = 3;
  public char item;

  public Torch(Main main, int x, int y, char item) {
    super(main, 32, 64);

    this.x = x;
    this.y = y;
    this.item = item;
  }

  @Override
  public boolean update(GameContainer gc) throws SlickException {
    if (++spriteIndexIncrementor == 15) {
      spriteIndexIncrementor = 0;
      if (++spriteIndex == 5) {
        spriteIndex = 3;
      }
    }

    if (main.intersectsWhip(this) || main.intersectsWeapon(this)) {
      main.pushThing(new Spark(main, this));
      main.pushThing(main.createCandleItem((int)x, (int)y, item));
      main.pushThing(new Flame(main, x, y + 24, 0, 0, -0.08f, 0, 10));
      main.playSound(main.torch_breaks);
      return false;
    }

    return true;
  }

  @Override
  public void render(GameContainer gc, Graphics g) throws SlickException {
    main.draw(main.fires[spriteIndex], x, y);
    main.draw(main.torch, x, y + 32);
  }
}

