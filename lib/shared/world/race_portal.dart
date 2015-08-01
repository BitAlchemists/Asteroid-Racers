part of world;

class RacePortal extends Entity {
  
  var raceController; //will not replicate to clients
  
  List<Entity> positions = new List<Entity>();
  
  RacePortal() : super(type: EntityType.LAUNCH_PLATFORM);
  
  RacePortal.fromJson(List list) : super.fromJson(list){
    for(List rawPosition in list[7]){
      Entity entity = new Entity.fromJson(rawPosition);
      positions.add(entity);
    }
  }
  
  toJson(){
    try{
      List list = super.toJson();
      List rawPositions = [];
      for(Entity position in positions){
        List rawPosition = position.toJson();
        rawPositions.add(rawPosition);
      }
      list.add(rawPositions);
      return list;      
    }
    catch(e){
      print("exception in RacePortal.toJson()");
      print(exceptionDetails(e));
      return null;
    }
  }
  
  copyFrom(RacePortal platform){
    super.copyFrom(platform);
    positions = platform.positions;
  }
}