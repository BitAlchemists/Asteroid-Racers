part of world;

class Checkpoint extends Entity {
  
  CheckpointState state;
  
  Checkpoint() : super(type: EntityType.CHECKPOINT);
  Checkpoint.copy(Checkpoint checkpoint) : super.copy(checkpoint);
  
  copyFrom(Checkpoint entity){
    super.copyFrom(entity);
    state = entity.state;
  }
}