part of game_server;

class SceneController{

  static createScene1(World world){
    List<Entity> asteroids = new List<Entity>();

    asteroids.addAll(world.generateAsteroidBelt(500, -2000, 250, 4000, 4000));
    asteroids.addAll(world.generateAsteroidBelt(20, -300, -100, 200, -1000));
    asteroids.addAll(world.generateAsteroidBelt(20, 100, -100, 200, -1000));
    asteroids.addAll(world.generateAsteroidBelt(20, -150, -1300, 300, -300));
    world.addEntities(asteroids);
    world.passiveCollissionEntities = asteroids;

    //what? :P
    _addArrow({num x: 0.0, num y: 0.0, double orientation: 0.0}) => world.addEntity(createArrow(x:x,y:y,orientation:orientation));

    _addArrow(y: -400, orientation: Math.PI);
    _addArrow(y: -200, orientation: Math.PI);
    _addArrow(x: 100, y: -1200, orientation: Math.PI * 1.25);
    _addArrow(x: -100, y: -1200, orientation: Math.PI * 0.75);
    _addArrow(x: 150, y: -1700, orientation: Math.PI * 0.5);
    _addArrow(x: -150, y: -1700, orientation: Math.PI * 1.5);

  }

  static createRace1(World world, RaceController race){
    race.addStart(0.0, -200.0, Math.PI);
    race.addCheckpoint(0.0, -600.0, Math.PI);
    race.addFinish(0.0, -800.0, Math.PI);

    world.addEntities(race.checkpoints);
    world.addEntity(race.start);
    world.addEntity(race.finish);
  }


  static createArrow({num x: 0.0, num y: 0.0, double orientation: 0.0}){
    Entity arrow = new Entity(type: EntityType.ARROWS);
    arrow.position = new Vector2(x.toDouble(), y.toDouble());
    arrow.orientation = orientation;
    arrow.radius = 100.0;
    return arrow;
  }
}