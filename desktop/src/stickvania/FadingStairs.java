package stickvania;

import org.newdawn.slick.*;

public class FadingStairs extends Thing {

  private static final float FRACTION = 1f / 91f;
  
  private boolean fading;
  private int fade = 91;
  private StageSegment segment;

  public FadingStairs(Main main, float x, float y, StageSegment segment) {
    super(main, 96, 64);
    this.x = x;
    this.y = y;
    this.segment = segment;
  }

  @Override
  public boolean update(GameContainer gc) throws SlickException {

    if (fading) {
      if (--fade == 0) {
        return false;
      }
    } else if (((int)main.simon.y) <= 224) {
      fading = true;
      segment.map[10][1] = Main.BLOCK_EMPTY;
      segment.map[9][2] = Main.BLOCK_E;
      segment.walls[10][1] = Main.WALL_EMPTY;
      segment.walls[9][2] = Main.WALL_PLATFORM;
      main.requestSong(main.stage_4_2);
    }

    return true;
  }

  @Override
  public void render(GameContainer gc, Graphics g) throws SlickException {
    if (fading) {
      float alpha = fade * FRACTION;
      main.drawFaded(
          main.blocks[Main.BLOCK_STAIRS_RIGHT_CAPPED], 64, 288, alpha);
      main.drawFaded(main.blocks[Main.BLOCK_STAIRS_RIGHT], 32, 320, alpha);
    }
  }
}
