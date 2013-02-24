part of asteroidracers;

class Entity {
  final String name;
  Point position;
  List<Component> components;

  Entity(String this.name, Point this.position) {

    components = new List<Component>();
    //bodySize = solarSystem.normalizePlanetSize(bodySize);
  }
  
  void addComponent(Component component) {
    components.add(component);
    component.entity = this;
  }
  
  void updatePosition() {
    position.x += speed.x;
    position.y += speed.y;
  }
 
}