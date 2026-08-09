package stickvania;

public class StageSegment {
  public int direction;
  public int stageSegmentIndex;
  public char[][] stage;
  public String candleItems;
  
  public int[][] map;
  public int[][] walls;  
  public int mapWidth;
  public Region[] regions;
  public int regionIndex;
  public StairsEntry[] stairsEntries;
}
