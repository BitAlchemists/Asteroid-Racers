part of ar_shared;

class EntityType {
  static const String ASTEROID = "ASTEROID";
  static const String SHIP = "SHIP";
}

class Entity
{
  int id;
  String type;
  String displayName;
  Vector2 position;
  double rotationSpeed = 0.0;
  double orientation = 0.0;
  Vector2 acceleration = new Vector2.zero();
  Vector2 velocity = new Vector2.zero();
  double radius = 1.0;
  bool canMove = false;
    
  Entity(this.type, this.position, this.radius);
  Entity.fromJson(List list){
    id = list[0];
    type = list[1];
    position = new Vector2((list[2] as num).toDouble(), (list[3] as num).toDouble());
    rotationSpeed = (list[4] as num).toDouble();
    orientation = (list[5] as num).toDouble();
    acceleration = new Vector2((list[6] as num).toDouble(), (list[7] as num).toDouble());
    velocity = new Vector2((list[8] as num).toDouble(), (list[9] as num).toDouble());
    displayName = list[10];
    radius = (list[11] as num).toDouble();
    canMove = list[12];
  }
  
  toJson(){
    List list = [
                     id,                    // 0
                     type,                  // 1
                     position.x,            // 2
                     position.y,            // 3
                     rotationSpeed,         // 4
                     orientation,           // 5
                     acceleration.x,        // 6
                     acceleration.y,        // 7
                     velocity.x,            // 8
                     velocity.y,            // 9
                     displayName,           //10
                     radius,                //11
                     canMove];//12
    return list;// JSON.encode(list);
  }
  
  void copyFrom(Entity entity) {
    id = entity.id;
    type = entity.type;
    position = entity.position;
    rotationSpeed = entity.rotationSpeed;
    orientation = entity.orientation;
    acceleration = entity.acceleration;
    velocity = entity.velocity;
    displayName = entity.displayName;
    radius = entity.radius;
    canMove = entity.canMove;
  }
}