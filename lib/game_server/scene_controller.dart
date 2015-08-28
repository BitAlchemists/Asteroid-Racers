part of game_server;

class SceneController{

  static double xOffset = 250.0;
  static double blockLength = 2000.0;
  static double corridorWidth = 200.0;

  static createScene2(World world){
    List<Entity> asteroids = new List<Entity>();

    asteroids.addAll(generateAsteroidBelt(xOffset, -blockLength - corridorWidth/2, blockLength, blockLength));
    asteroids.addAll(generateAsteroidBelt(xOffset, corridorWidth/2, blockLength, blockLength));
    asteroids.addAll(generateAsteroidBelt(xOffset + blockLength + corridorWidth, -blockLength - corridorWidth/2, blockLength, blockLength));
    asteroids.addAll(generateAsteroidBelt(xOffset + blockLength + corridorWidth, corridorWidth/2, blockLength, blockLength));
    world.addEntities(asteroids);
    world.passiveCollissionEntities = asteroids;
  }

  static createRace2(World world, RaceController race){
    race.addStart(xOffset, 0.0, Math.PI * 0.5);
    race.addCheckpoint(xOffset + blockLength + corridorWidth + blockLength, 0.0, Math.PI); //right
    race.addCheckpoint(xOffset + blockLength + corridorWidth + blockLength, blockLength, Math.PI); //down right
    race.addCheckpoint(xOffset + blockLength + corridorWidth, blockLength, Math.PI); //down
    race.addCheckpoint(xOffset + blockLength + corridorWidth/2, -blockLength, Math.PI); // top
    race.addCheckpoint(xOffset, -blockLength, Math.PI); // top left
    race.addFinish(xOffset, -corridorWidth, Math.PI);

    world.addEntities(race.checkpoints);
    world.addEntity(race.start);
    world.addEntity(race.finish);

    //what? :P
    _addArrow({num x: 0.0, num y: 0.0, double orientation: 0.0}) => world.addEntity(createArrow(x:x,y:y,orientation:orientation));

    _addArrow(y: -400, orientation: Math.PI);
    _addArrow(y: -200, orientation: Math.PI);
    _addArrow(x: 100, y: -1200, orientation: Math.PI * 1.25);
    _addArrow(x: -100, y: -1200, orientation: Math.PI * 0.75);
    _addArrow(x: 150, y: -1700, orientation: Math.PI * 0.5);
    _addArrow(x: -150, y: -1700, orientation: Math.PI * 1.5);
  }

  static createScene1(World world){
    List<Entity> asteroids = new List<Entity>();

    asteroids.addAll(generateAsteroidBelt(-2000, 250, 4000, 4000));
    asteroids.addAll(generateAsteroidBelt(-300, -100, 200, -1000, count:20));
    asteroids.addAll(generateAsteroidBelt(100, -100, 200, -1000, count:20));
    asteroids.addAll(generateAsteroidBelt(-150, -1300, 300, -300, count:20));
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



  ///please only give positive values
  static List<Entity> generateAsteroidBelt(num x, num y, num width, num height, {int count:null, num densityFactor:1}){

    if(count == null){
      double defaultDensity = 500 / (4000*4000);
      double density = defaultDensity * densityFactor;
      count = (width * height * density).toInt();
    }

    List<Entity> asteroids = new List<Entity>();
    Vector2 offset = new Vector2(x.toDouble(), y.toDouble());
    num minRadius = 3;
    num maxRadius = 30;

    Math.Random random = new Math.Random();

    for (int i = 0; i < count; i++) {
      num radius = random.nextDouble() * (maxRadius - minRadius) + minRadius;

      //rectangle
      Vector2 point = offset + new Vector2(
      //negatives width/height values will lead to wrong borders here
          radius + random.nextDouble() * (width - 2*radius),
          radius + random.nextDouble() * (height - 2*radius));

      /*
      //circle
      num angle = random.nextDouble() * 2 * Math.PI;
      num radius = random.nextDouble();
      vec3 point = new vec3(radius * xDistance * cos(angle), radius * yDistance * sin(angle), 0);
      */


      Entity entity = new Entity(type: EntityType.ASTEROID, position: point, radius: radius);
      asteroids.add(entity);
    }

    return asteroids;
  }

}