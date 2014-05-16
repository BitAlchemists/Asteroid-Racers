part of ar_client;

class Entity {
  final String name;
  Vector2 position;
  double orientation;
  RenderChunk renderChunk;

  Entity(String this.name, Vector2 this.position) {
    orientation = 0.0;
  }
  
  //physics
  double acceleration = 0.0;
  Vector2 velocity = new Vector2.zero();
  
  void accelerate() {
    acceleration = 1.0;  
  }
  
  void decelerate() {
    acceleration = -1.0;
  }
}