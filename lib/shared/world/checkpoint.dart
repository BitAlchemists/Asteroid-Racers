part of ar_shared;

class Checkpoint extends Entity {
  
  int state;
  
  Checkpoint() : super(EntityType.CHECKPOINT);
  Checkpoint.copy(Checkpoint checkpoint) : super.copy(checkpoint);
  
  Checkpoint.fromJson(List list) : super.fromJson(list){
    this.state = (list[7] as num).toInt();
  }
  
  toJson(){
    return super.toJson()..add(this.state);
  }
  
  copyFrom(Checkpoint entity){
    super.copyFrom(entity);
    state = entity.state;
  }
}