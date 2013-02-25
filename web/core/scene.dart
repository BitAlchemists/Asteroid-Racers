part of asteroidracers;


class Scene {
  List<Entity> entities = new List<Entity>();
}

class AsteroidsScene extends Scene {

  AsteroidsScene() {
    addAsteroidBelt(30); 
  }

  void addAsteroidBelt(int count) {
    Random random = new Random();

    for (int i = 0; i < count; i++) {
      int xDistance = 500;
      int yDistance = 500;
      vec3 point = new vec3(random.nextDouble() * 2 * xDistance - xDistance, random.nextDouble() * 2 * yDistance - yDistance, 0);
      Entity entity = new Entity("asteroid", point);
      entities.add(entity);
    }
  }

  
/*
  num normalizePlanetSize(num r) {
    return log(r + 1) * (width / 100.0);
  }
  */
}
