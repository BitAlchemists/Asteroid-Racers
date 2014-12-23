part of ar_shared;

class Checkpoint extends Entity {
  
  CheckpointState state;
  
  Checkpoint() : super(EntityType.CHECKPOINT);
  Checkpoint.copy(Checkpoint checkpoint) : super.copy(checkpoint);
  
  Checkpoint.fromJson(List list) : super.fromJson(list){
    int stateIndex = (list[7] as num).toInt();
    this.state = stateIndex == null ? null : CheckpointState.values[stateIndex];
  }
  
  toJson(){
    return super.toJson()..add(this.state.index);
  }
  
  copyFrom(Checkpoint entity){
    super.copyFrom(entity);
    state = entity.state;
  }
}