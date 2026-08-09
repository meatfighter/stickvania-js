package stickvania;

import org.newdawn.slick.*;

public class HolyWater extends Thing {

  public static final int STATE_DROPPING = 0;
  public static final int STATE_FIRE = 1;

  public int direction;
  public int state;
  public int cycle;
  public int spriteIndex;
  public int delay;

  public HolyWater(Main main, float x, float y, int direction) {
    super(main, 32, 27);
    this.x = x;
    this.y = y;
    this.vx = direction == Main.RIGHT ? 3 : -3;
    this.vy = -1.5f;
    this.direction = direction;
    state = STATE_DROPPING;
    main.playSound(main.threw_dagger);
  }

  @Override
  public boolean update(GameContainer gc) throws SlickException {
    if (state == STATE_DROPPING) {
      applyGravity();      
      if (supported || !moveX(vx) || intersected) {
        y -= 5;
        rx1 = 0;
        ry1 = 0;
        rx2 = 31;
        ry2 = 31;
        state = STATE_FIRE;
        main.playSound(main.used_holy_water);
      }
    } else {
      if (++delay == 15) {
        delay = 0;
        spriteIndex++;
        if (spriteIndex == 5) {
          spriteIndex = 0;
          cycle++;
          if (cycle == 2) {
            return false;
          }
        }
      }
    }

    if (x < main.camera - 96 || x > main.camera + 576 || y > 352) {
      return false;
    }
    
    return true;
  }

  @Override
  public void render(GameContainer gc, Graphics g) throws SlickException {
    if (state == STATE_DROPPING) {
      main.draw(main.holyWaters[direction], x, y);
    } else {
      main.draw(main.fires[spriteIndex], x, y);
    }
  }
}
