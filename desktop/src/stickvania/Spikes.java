package stickvania;

import org.newdawn.slick.GameContainer;
import org.newdawn.slick.Graphics;
import org.newdawn.slick.SlickException;

public class Spikes extends Thing {

  private float top;
  private int index;
  private boolean lifting;
  private boolean liftFast;

  public Spikes(Main main, float x, float y, int index) {
    super(main, 64, 32);
    this.x = x;
    this.top = this.y = y;
    this.index = index;
  }

  @Override
  public boolean update(GameContainer gc) throws SlickException {

    if (main.timeFrozen == 0) {
      if (lifting) {
        if (liftFast) {
          y -= 2f;
        } else {
          y -= 1f;
        }
        if (y <= top) {
          y = top;
          vy = 0;
          lifting = false;          
          if (index == 0) {
            liftFast = !liftFast;
          }
        }
      } else {
        applyGravity();
        if (supported || (index == 1 && y >= top + 78)) {
          lifting = true;
          main.playSound(main.ching);
          if (index == 1) {
            y = top + 78;
          }
        }
      }
    }

    if (main.intersectsSimon(this)) {
      main.hurtSimon(16);
    }

    return true;
  }

  @Override
  public void render(GameContainer gc, Graphics g) throws SlickException {
    main.draw(main.spikes, x, y);
  }
}
