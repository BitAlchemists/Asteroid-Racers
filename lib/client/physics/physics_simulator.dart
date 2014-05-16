part of ar_client;

class PhysicsSimulator {
  var scene;
  
  PhysicsSimulator(this.scene);
  
  void simulate(num dt) {
    const num maxPlayerSpeed = 100;
    
    scene.entities.forEach((Entity entity) {
      Vector2 acceleration = new Vector2.zero();
        //new Matrix3.identity();//.
        //rotationZ(entity.orientation * Math.PI).
        //translate(0.0, entity.acceleration * maxPlayerSpeed).
        //getTranslation();
          
      entity.velocity += acceleration * dt;
      entity.position += entity.velocity * dt;
      entity.acceleration = 0.0;
    });
  }
  
}

