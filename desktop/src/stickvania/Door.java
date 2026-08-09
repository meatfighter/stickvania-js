package stickvania;

import org.newdawn.slick.*;

public class Door extends Thing {

  public static final int STATE_CLOSED = 0;
  public static final int STATE_SCROLL_1 = 1;
  public static final int STATE_DIAGONAL_1 = 2;
  public static final int STATE_OPEN = 3;
  public static final int STATE_WALKING = 4;
  public static final int STATE_DIAGONAL_2 = 5;
  public static final int STATE_SCROLL_2 = 6;

  public int state = STATE_CLOSED;
  public int direction;
  public int doorScroll1;
  public int doorScroll2;
  public int doorDelay;
  public boolean active;

  public Door(Main main, int x, int y, int direction, boolean active) {
    super(main, 16, 96);

    this.x = x;
    this.y = y;
    this.direction = direction;
    this.active = active;
  }

  @Override
  public boolean update(GameContainer gc) throws SlickException {

    if (!active) {
      return true;
    }

    if (direction == Main.RIGHT) {
      switch(state) {
        case STATE_CLOSED:
          if (main.simon.supported
              && ((int)main.simon.y) - 32 == (int)y
              && ((int)Math.abs(main.simon.x - x + 24)) <= 32
              && !main.simon.hurt && main.playerPower > 0) {
            main.enterNextRegion(this);
          }
          break;
        case STATE_SCROLL_1:
          main.camera += 2;
          if (main.camera >= doorScroll1) {
            state = STATE_DIAGONAL_1;
            doorDelay = 10;
            main.playSound(main.door_opens_1);
          }
          break;
        case STATE_DIAGONAL_1:
          if (--doorDelay == 0) {
            state = STATE_OPEN;
            doorDelay = 70;
          }
          break;
        case STATE_OPEN:
          main.simon.walkRight();
          if (--doorDelay == 0) {
            state = STATE_DIAGONAL_2;
            doorDelay = 10;
          }
          break;
        case STATE_DIAGONAL_2:
          if (--doorDelay == 0) {
            state = STATE_SCROLL_2;
          }
          break;
        case STATE_SCROLL_2:
          main.camera += 2;
          if (main.camera >= doorScroll2) {
            state = STATE_CLOSED;
            main.door = null;
            main.oldThingStack.clear();
            main.simon.xMin = main.camera;
          }
          break;
      }
    } else {
      switch(state) {
        case STATE_CLOSED:
          if (main.simon.supported
              && ((int)main.simon.y) - 32 == (int)y
              && ((int)Math.abs(main.simon.x - x + 24)) <= 32
              && !main.simon.hurt && main.playerPower > 0) {
            main.enterNextRegion(this);
          }
          break;
        case STATE_SCROLL_1:
          main.camera -= 2;
          if (main.camera <= doorScroll1) {
            state = STATE_DIAGONAL_1;
            doorDelay = 10;
            main.playSound(main.door_opens_2);
          }
          break;
        case STATE_DIAGONAL_1:
          if (--doorDelay == 0) {
            state = STATE_OPEN;
            doorDelay = 70;
          }
          break;
        case STATE_OPEN:
          main.simon.walkLeft();
          if (--doorDelay == 0) {
            state = STATE_DIAGONAL_2;
            doorDelay = 10;
          }
          break;
        case STATE_DIAGONAL_2:
          if (--doorDelay == 0) {
            state = STATE_SCROLL_2;
          }
          break;
        case STATE_SCROLL_2:
          main.camera -= 2;
          if (main.camera <= doorScroll2) {
            state = STATE_CLOSED;
            main.door = null;
            main.oldThingStack.clear();
            main.moveCamera();
          }
          break;
      }
    }
    return true;
  }

  @Override
  public void render(GameContainer gc, Graphics g) throws SlickException {
    if (direction == Main.RIGHT) {
      if (state == STATE_OPEN) {
        main.draw(main.doors[Main.RIGHT][2], x, y);
      } else if (state == STATE_DIAGONAL_1 || state == STATE_DIAGONAL_2) {
        main.draw(main.doors[Main.RIGHT][1], x, y);
      } else {
        main.draw(main.doors[Main.RIGHT][0], x, y);
      }
    } else {
      if (state == STATE_OPEN) {
        main.draw(main.doors[Main.LEFT][2], x - 32, y);
      } else if (state == STATE_DIAGONAL_1 || state == STATE_DIAGONAL_2) {
        main.draw(main.doors[Main.LEFT][1], x - 16, y);
      } else {
        main.draw(main.doors[Main.LEFT][0], x, y);
      }
    }
  }
}
