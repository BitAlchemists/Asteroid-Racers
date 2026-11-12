part of world;

class RacePortal extends Entity {
  
  var raceController; //will not replicate to clients
  
  List<Entity> positions = new List<Entity>();
  
  RacePortal() : super(type: EntityType.LAUNCH_PLATFORM);
  
  copyFrom(RacePortal platform){
    super.copyFrom(platform);
    positions = platform.positions;
  }
}