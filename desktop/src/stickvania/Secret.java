package stickvania;

import org.newdawn.slick.*;

public class Secret extends Thing {

  private int delay;

  public Secret(Main main, float x, float y) {
    super(main, 576, 128);
    this.x = x;
    this.y = y;
  }

  @Override
  public boolean update(GameContainer gc) throws SlickException {

    if (main.intersectsSimon(this)) {
      if (delay > 0) {
        delay--;
      } else {
        delay = 91;

        int X = (int)(main.simon.x + main.random.nextInt(32));

        if (main.simon.whipType + main.visibleWhipCount < 2) {
          main.whipCreated();
          main.pushThing(new DropItem(main, X, -32, DropItem.TYPE_WHIP));
        } else if (main.hearts < 99) {
          if (main.hearts + 5 >= 99) {
            delay = 91;
          } else {
            delay = 10;
          }
          main.pushThing(new DropItem(main, X, -32, DropItem.TYPE_LARGE_HEART));
        } else if (main.weaponType != Main.WEAPON_TYPE_BOOMERANG) {
          main.pushThing(new DropItem(main, X, -32, DropItem.TYPE_BOOMERANG));
        } else if (main.weaponRepeats == 0) {
          main.pushThing(new DropItem(main, X, -32, DropItem.TYPE_DOUBLE));
        } else if (main.weaponRepeats == 1) {
          main.pushThing(new DropItem(main, X, -32, DropItem.TYPE_TRIPLE));
        } else if (main.playerPower != 16) {
          main.pushThing(new DropItem(main, X, -32, DropItem.TYPE_MEAT));
        }
      }
    }

    return true;
  }

  @Override
  public void render(GameContainer gc, Graphics g) throws SlickException {
  }
}
