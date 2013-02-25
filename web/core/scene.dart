part of asteroidracers;


class Scene {
  List<Entity> entities = new List<Entity>();
}

class AsteroidsScene extends Scene {

  AsteroidsScene(int count, int xDistance, int yDistance) {
    addAsteroidBelt(count, xDistance, yDistance);
  }

  void addAsteroidBelt(int count, int xDistance, int yDistance) {
    Math.Random random = new Math.Random();

    for (int i = 0; i < count; i++) {
      //rectangle 
      vec3 point = new vec3(random.nextDouble() * 2 * xDistance - xDistance, random.nextDouble() * 2 * yDistance - yDistance, 0);
      
      /*
      //circle
      num angle = random.nextDouble() * 2 * Math.PI;
      num radius = random.nextDouble();
      vec3 point = new vec3(radius * xDistance * cos(angle), radius * yDistance * sin(angle), 0);
      */
      
      Entity entity = new Entity("asteroid", point);
      entity.addComponent(new GraphicsComponent.asteroid());
      entities.add(entity);
    }
  }

  
/*
  num normalizePlanetSize(num r) {
    return log(r + 1) * (width / 100.0);
  }
  */
}
