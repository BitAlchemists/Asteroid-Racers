part of ar_client;

class Entity {
  final String name;
  vec2 position;
  double orientation;
  RenderChunk renderChunk;

  Entity(String this.name, vec3 this.position) {
    orientation = 0.0;
  }
  
  //physics
  double acceleration = 0.0;
  vec3 velocity = new vec3.zero();
  
  void accelerate() {
    acceleration = 1.0;  
  }
  
  void decelerate() {
    acceleration = -1.0;
  }
}