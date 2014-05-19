part of ar_shared;

class EntityType {
  static const String ASTEROID = "ASTEROID";
  static const String SHIP = "SHIP";
}

class Entity
{
  int id;
  String type;
  Vector2 position;
  double rotationSpeed = 0.0;
  double orientation = 0.0;
  Vector2 acceleration = new Vector2.zero();
  Vector2 velocity = new Vector2.zero();
    
  Entity(this.type, this.position);
  Entity.fromJson(List list){
    id = list[0];
    type = list[1];
    position = new Vector2(list[2], list[3]);
    rotationSpeed = list[4];
    orientation = list[5];
    acceleration = new Vector2(list[6], list[7]);
    velocity = new Vector2(list[8], list[9]);
  }
  
  toJson(){
    List list = [
                     id,            //0
                     type,          //1
                     position.x,    //2
                     position.y,    //3
                     rotationSpeed, //4
                     orientation,   //5
                     acceleration.x,//6
                     acceleration.y,//7
                     velocity.x,    //8
                     velocity.y];   //9
    return list;// JSON.encode(list);
  }
}