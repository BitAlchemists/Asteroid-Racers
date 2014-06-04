part of ar_shared;

class RacePortal extends Entity {
  
  List<Entity> positions = new List<Entity>();
  
  RacePortal() : super(EntityType.LAUNCH_PLATFORM);
  
  RacePortal.fromJson(List list) : super.fromJson(list){
    for(List rawPosition in list[7]){
      Entity entity = new Entity.fromJson(rawPosition);
      positions.add(entity);
    }
  }
  
  toJson(){
    List list = super.toJson();
    List rawPositions = [];
    for(Entity position in positions){
      List rawPosition = position.toJson();
      rawPositions.add(rawPosition);
    }
    list.add(rawPositions);
    return list;
  }
  
  copyFrom(RacePortal platform){
    super.copyFrom(platform);
    positions = platform.positions;
  }
}