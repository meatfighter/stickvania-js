package stickvania;

import org.newdawn.slick.*;

public abstract class Thing {

  public Main main;
  public float x;
  public float y;
  public float vx;
  public float vy;
  public int rx1;
  public int ry1;
  public int rx2;
  public int ry2;
  public boolean supported;
  public boolean intersected;
  public boolean kill;
  public float G = Main.GRAVITY;

  public Thing(Main main) {
    this.main = main;
  }

  public Thing(Main main, int rx1, int ry1, int width, int height) {
    this.main = main;
    this.rx1 = rx1;
    this.ry1 = ry1;
    this.rx2 = rx1 + width - 1;
    this.ry2 = ry1 + height - 1;
  }

  public Thing(Main main, int width, int height) {
    this.main = main;
    rx2 = width - 1;
    ry2 = height - 1;
  }

  public abstract void render(
      GameContainer gc, Graphics g) throws SlickException;
  public abstract boolean update(GameContainer gc) throws SlickException;

  public boolean moveY(float dy) {
    supported = false;

    float targetY = y + dy;

    int y1 = (int)(y + ry2);
    int y2 = (int)(targetY + ry2);

    int x1 = (int)(x + rx1);
    int x2 = (int)(x + rx2);

    if (vy >= 0) {
      for(int i = y1; i <= y2; i++) {
        for(int j = x1; j <= x2; j += 32) {
          if (main.isEmpty(j, i) && main.isSupportive(j, i + 1)) {
            y = i - ry2;
            supported = true;
            return false;
          }
        }
        if (main.isEmpty(x2, i) && main.isSupportive(x2, i + 1)) {
          y = i - ry2;
          supported = true;
          return false;
        }
      }
    } else {
      for(int i = y1; i >= y2; i--) {
        for(int j = x1; j <= x2; j += 32) {
          int Y = i - ry2;
          if (main.isEmpty(j, Y) && main.isSolid(j, Y - 1)) {
            y = Y;
            return false;
          }
        }
        int Y = i - ry2;
        if (main.isEmpty(x2, Y) && main.isSolid(x2, Y - 1)) {
          y = Y;
          return false;
        }
      }
    }

    y = targetY;
    return true;
  }

  public boolean moveX(float dx) {

    // allowed:
    // platform -> empty
    // platform -> platform
    // empty -> empty

    int y1 = (int)(y + ry1);
    int y2 = (int)(y + ry2);

    if (dx < 0) {

      int x1 = (int)(x + rx1);
      int x2 = (int)(x + rx1 + dx);

      for(int j = x1; j >= x2; j--) {
        for(int i = y1; i <= y2; i += 32) {
          int a = main.getWall(j, i);
          int b = main.getWall(j - 1, i);
          if (!((a == Main.WALL_EMPTY && b == Main.WALL_EMPTY)
              || (a == Main.WALL_PLATFORM
                  && (b == Main.WALL_EMPTY || b == Main.WALL_PLATFORM)))) {
            x = j - rx1;
            return false;
          }
        }
        int a = main.getWall(j, y2);
        int b = main.getWall(j - 1, y2);
        if (!((a == Main.WALL_EMPTY && b == Main.WALL_EMPTY)
            || (a == Main.WALL_PLATFORM
                && (b == Main.WALL_EMPTY || b == Main.WALL_PLATFORM)))) {
          x = j - rx1;
          return false;
        }
      }

      x += dx;
      
      if (x + rx1 <= main.simon.xMin) {
        x = main.simon.xMin - rx1;
        return false;
      }

    } else {

      int x1 = (int)(x + rx2);
      int x2 = (int)(x + rx2 + dx);

      for(int j = x1; j <= x2; j++) {
        for(int i = y1; i <= y2; i += 32) {
          int a = main.getWall(j, i);
          int b = main.getWall(j + 1, i);
          if (!((a == Main.WALL_EMPTY && b == Main.WALL_EMPTY)
              || (a == Main.WALL_PLATFORM
                  && (b == Main.WALL_EMPTY || b == Main.WALL_PLATFORM)))) {
            x = j - rx2;
            return false;
          }
        }
        int a = main.getWall(j, y2);
        int b = main.getWall(j + 1, y2);
        if (!((a == Main.WALL_EMPTY && b == Main.WALL_EMPTY)
            || (a == Main.WALL_PLATFORM
                && (b == Main.WALL_EMPTY || b == Main.WALL_PLATFORM)))) {
          x = j - rx2;
          return false;
        }
      }

      x += dx;

      if (x + rx2 >= main.simon.xMax) {
        x = main.simon.xMax - rx2;
        return false;
      }
    }

    return true;
  }

  public void applyGravityWithPlatforms() {

    supported = false;

    float targetY = y + vy;

    int y1 = (int)(y + ry2);
    int y2 = (int)(targetY + ry2);

    int x1 = (int)(x + rx1);
    int x2 = (int)(x + rx2);

    vy += G;
    if (vy >= 0) {
      for(int i = y1; i <= y2; i++) {
        for(int j = x1; j <= x2; j += 32) {
          if (main.isEmpty(j, i) && main.isSupportive(j, i + 1)) {
            y = i - ry2;
            vy = 0;
            supported = true;
            return;
          }
        }
        if (main.isEmpty(x2, i) && main.isSupportive(x2, i + 1)) {
          y = i - ry2;
          vy = 0;
          supported = true;
          return;
        }

        for(int j = x1; j <= x2; j += 32) {
          Thing platform = main.findPlatform(j, i + 1);
          if (platform != null && main.isEmpty(j, i)) {
            moveX(platform.vx);
            y = i - ry2;
            vy = 0;
            supported = true;
            return;
          }
        }

        Thing platform = main.findPlatform(x2, i + 1);
        if (platform != null && main.isEmpty(x2, i)) {
          moveX(platform.vx);
          y = i - ry2;
          vy = 0;
          supported = true;
          return;
        }
      }
    } else {
      for(int i = y1; i >= y2; i--) {
        for(int j = x1; j <= x2; j += 32) {
          int Y = i - ry2;
          if (main.isEmpty(j, Y) && main.isSolid(j, Y - 1)) {
            y = Y;
            vy = 0;
            return;
          }
        }
        int Y = i - ry2;
        if (main.isEmpty(x2, Y) && main.isSolid(x2, Y - 1)) {
          y = Y;
          vy = 0;
          return;
        }
      }
    }

    y = targetY;
  }

  public void applyGravity() {

    supported = false;

    float targetY = y + vy;

    int y1 = (int)(y + ry2);
    int y2 = (int)(targetY + ry2);

    int x1 = (int)(x + rx1);
    int x2 = (int)(x + rx2);

    vy += G;
    if (vy >= 0) {
      for(int i = y1; i <= y2; i++) {
        for(int j = x1; j <= x2; j += 32) {
          if (main.isEmpty(j, i) && main.isSupportive(j, i + 1)) {
            y = i - ry2;
            vy = 0;
            supported = true;
            return;
          }
        }
        if (main.isEmpty(x2, i) && main.isSupportive(x2, i + 1)) {
          y = i - ry2;
          vy = 0;
          supported = true;
          return;
        }
      }      
    } else {
      for(int i = y1; i >= y2; i--) {
        for(int j = x1; j <= x2; j += 32) {
          int Y = i - ry2;
          if (main.isEmpty(j, Y) && main.isSolid(j, Y - 1)) {
            y = Y;
            vy = 0;
            return;
          }
        }
        int Y = i - ry2;
        if (main.isEmpty(x2, Y) && main.isSolid(x2, Y - 1)) {
          y = Y;
          vy = 0;
          return;
        }
      }
    }

    y = targetY;
  }
}
