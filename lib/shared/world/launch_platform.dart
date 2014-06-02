part of ar_shared;

class LaunchPlatform extends Entity {
  
  List<Entity> positions = new List<Entity>();
  
  LaunchPlatform() : super(EntityType.LAUNCH_PLATFORM);
  
  LaunchPlatform.fromJson(List list) : super.fromJson(list){
    for(List rawPosition in list[7]){
      Entity entity = new Entity.fromJson(rawPosition);
      positions.add(entity);
    }
  }
  
  toJson(){
    List list = super.toJson();
    List rawPositions = [];
    for(Entity position in positions){
      list.add(position.toJson());
    }
    list.add(rawPositions);
    return list;
  }
  
  copyFrom(LaunchPlatform platform){
    super.copyFrom(platform);
    positions = platform.positions;
  }
}