part of game_server;

class SceneController{

  static double xOffset = 250.0;
  static double blockLength = 1000.0;
  static double corridorWidth = 200.0;

  static createScene2(World world){
    List<Entity> asteroids = new List<Entity>();

    asteroids.addAll(generateAsteroidBelt(xOffset, -blockLength - corridorWidth/2, blockLength, blockLength));
    asteroids.addAll(generateAsteroidBelt(xOffset, corridorWidth/2, blockLength, blockLength));
    asteroids.addAll(generateAsteroidBelt(xOffset + blockLength + corridorWidth, -blockLength - corridorWidth/2, blockLength, blockLength));
    asteroids.addAll(generateAsteroidBelt(xOffset + blockLength + corridorWidth, corridorWidth/2, blockLength, blockLength));
    world.addEntities(asteroids);
    world.passiveCollissionEntities.addAll(asteroids);
  }

  static createSmallDensityField(World world){

    int blockLength = 8000;

    List<Entity> asteroids = new List<Entity>();

    asteroids.addAll(generateAsteroidBelt(-blockLength/2, -blockLength/2, blockLength, blockLength, densityFactor:0.4));
    world.addEntities(asteroids);
    world.passiveCollissionEntities.addAll(asteroids);
  }

  static createRandomRace(World world, RaceController race){

    double minDistance = 500.0;
    double maxDistance = 1000.0;

    double randomAngle() => (random.nextDouble() * 2 - 1) * Math.PI * 0.5;

    double currentAngle = randomAngle();
    Entity currentCheckpoint = race.addStart(0.0, 0.0, currentAngle);

    int numOfCheckpoints = 8;
    for(int i = 0; i < numOfCheckpoints; i++){
      double a = Math.cos(currentAngle);
      double b = Math.sin(currentAngle);
      Vector2 direction = new Vector2(a, b);

      double firstArrowDistance = 200.0;
      Vector2 firstArrow = currentCheckpoint.position + direction.scaled(firstArrowDistance);
      world.addEntity(createArrow(firstArrow.x, firstArrow.y, currentAngle));

      double nextDistance = random.nextDouble() * (maxDistance-minDistance) + minDistance;
      Vector2 nextPos = currentCheckpoint.position + direction.scaled(nextDistance);

      double nextAngle = currentAngle + randomAngle();
      currentCheckpoint = race.addCheckpoint(nextPos.x, nextPos.y, nextAngle);
      currentAngle = nextAngle;
    }

    double a = Math.cos(currentAngle);
    double b = Math.sin(currentAngle);
    Vector2 direction = new Vector2(a, b);

    double firstArrowDistance = 200.0;
    Vector2 firstArrow = currentCheckpoint.position + direction.scaled(firstArrowDistance);
    world.addEntity(createArrow(firstArrow.x, firstArrow.y, currentAngle));

    double nextDistance = random.nextDouble() * (maxDistance-minDistance) + minDistance;
    Vector2 nextPos = currentCheckpoint.position + direction.scaled(nextDistance);

    double nextAngle = currentAngle + randomAngle();
    race.addFinish(nextPos.x, nextPos.y, nextAngle);

    world.addEntities(race.checkpoints);
    world.addEntity(race.start);
    world.addEntity(race.finish);

  }

  static createRace2(World world, RaceController race){

    //what? :P
    _addArrow({num x: 0.0, num y: 0.0, double orientation: 0.0}) => world.addEntity(createArrow(x, y, orientation));


    //left
    race.addStart(xOffset-corridorWidth*0.5, 0.0, Math.PI * 1.5);
    _addArrow(x: xOffset+corridorWidth*0.5, y: 0, orientation: Math.PI * 1.5);

    //center
    _addArrow(x: xOffset + blockLength - corridorWidth * 1.5, orientation: Math.PI * 1.5);
    _addArrow(x: xOffset + blockLength + corridorWidth * 2.5, orientation: Math.PI * 1.5);

    //right
    race.addCheckpoint(xOffset + blockLength + corridorWidth + blockLength + corridorWidth * 0.5, 0.0, Math.PI * 0.0);
    _addArrow(x: xOffset + blockLength + corridorWidth + blockLength + corridorWidth * 0.5, orientation: Math.PI * 0.0);

    //down right
    race.addCheckpoint(xOffset + blockLength + corridorWidth + blockLength + corridorWidth/2, blockLength + corridorWidth, Math.PI * 0.5);
    _addArrow(x: xOffset + blockLength + corridorWidth + blockLength + corridorWidth * 0.5, y:blockLength + corridorWidth, orientation: Math.PI * 0.5);

    //down
    race.addCheckpoint(xOffset + blockLength + corridorWidth * 0.5, blockLength + corridorWidth, Math.PI * 1.0);
    _addArrow(x: xOffset + blockLength + corridorWidth * 0.5, y:blockLength + corridorWidth, orientation: Math.PI * 1.0);

    //center
    _addArrow(x: xOffset + blockLength + corridorWidth * 0.5, y:corridorWidth * 1.5, orientation: Math.PI * 1.0);
    _addArrow(x: xOffset + blockLength + corridorWidth * 0.5, y:-corridorWidth * 1.5, orientation: Math.PI * 1.0);

    // top
    race.addCheckpoint(xOffset + blockLength + corridorWidth/2, -blockLength - corridorWidth, Math.PI * 0.5);
    _addArrow(x: xOffset + blockLength + corridorWidth * 0.5, y:-corridorWidth - blockLength, orientation: Math.PI * 0.5);

    // top left
    race.addCheckpoint(xOffset - corridorWidth * 0.5, -blockLength - corridorWidth, Math.PI * 0.0);
    _addArrow(x: xOffset - corridorWidth * 0.5, y:-corridorWidth - blockLength, orientation: Math.PI * 0.0);


    race.addFinish(xOffset - corridorWidth * 0.5, corridorWidth, Math.PI);

    world.addEntities(race.checkpoints);
    world.addEntity(race.start);
    world.addEntity(race.finish);

  }

  static createScene1(World world){
    List<Entity> asteroids = new List<Entity>();

    asteroids.addAll(generateAsteroidBelt(-2000, 250, 4000, 4000));
    asteroids.addAll(generateAsteroidBelt(-300, -100, 200, -1000, count:20));
    asteroids.addAll(generateAsteroidBelt(100, -100, 200, -1000, count:20));
    asteroids.addAll(generateAsteroidBelt(-150, -1300, 300, -300, count:20));
    world.addEntities(asteroids);
    world.passiveCollissionEntities.addAll(asteroids);

    //what? :P
    _addArrow({num x: 0.0, num y: 0.0, double orientation: 0.0}) => world.addEntity(createArrow(x, y, orientation));

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


  static createArrow(num x, num y, double orientation){
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
    num minRadius = 6;
    num maxRadius = 60;

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