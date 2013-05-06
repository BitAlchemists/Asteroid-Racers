part of ar_client;

class PhysicsSimulator {
  Scene scene;
  
  PhysicsSimulator(this.scene);
  
  void simulate(num dt) {
    const num maxPlayerSpeed = 100;
    
    scene.entities.forEach((Entity entity) {
      vec3 acceleration = 
        new mat4.identity().
        rotateZ(entity.orientation * Math.PI).
        translate(0.0, entity.acceleration * maxPlayerSpeed, 0.0).
        getTranslation();
          
      entity.speed += acceleration * dt;
      entity.position += entity.speed * dt;
      entity.acceleration = 0.0;
    });
  }
  
}

