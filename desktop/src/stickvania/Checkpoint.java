package stickvania;

import org.newdawn.slick.*;

public class Checkpoint extends Thing {

  public int stageSegmentIndex;
  public int regionIndex;
  public Song song;

  public Checkpoint(
      Main main, float x, float y, int stageSegmentIndex, int regionIndex) {
    super(main);

    this.x = x;
    this.y = y;
    this.stageSegmentIndex = stageSegmentIndex;
    this.regionIndex = regionIndex;
  }

  @Override
  public boolean update(GameContainer gc) throws SlickException {

    main.checkpointReached(this);

    return false;
  }

  @Override
  public void render(GameContainer gc, Graphics g) throws SlickException {
  }
}
