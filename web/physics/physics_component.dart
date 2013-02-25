part of asteroidracers;

class PhysicsComponent extends Component {
  
  double acceleration = 0.0;
  vec3 speed = new vec3();
  
  void accelerate() {
    acceleration = 1.0;  
  }
  
  void decelerate() {
    acceleration = -1.0;
  }
  
}

