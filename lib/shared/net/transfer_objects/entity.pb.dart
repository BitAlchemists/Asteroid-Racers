///
//  Generated code. Do not modify.
///
library net_entity;

import 'package:protobuf/protobuf.dart';

class Vector2 extends GeneratedMessage {
  static final BuilderInfo _i = new BuilderInfo('Vector2')
    ..a(1, 'x', GeneratedMessage.QD)
    ..a(2, 'y', GeneratedMessage.QD)
  ;

  Vector2() : super();
  Vector2.fromBuffer(List<int> i, [ExtensionRegistry r = ExtensionRegistry.EMPTY]) : super.fromBuffer(i, r);
  Vector2.fromJson(String i, [ExtensionRegistry r = ExtensionRegistry.EMPTY]) : super.fromJson(i, r);
  Vector2 clone() => new Vector2()..mergeFromMessage(this);
  BuilderInfo get info_ => _i;
  static Vector2 create() => new Vector2();
  static PbList<Vector2> createRepeated() => new PbList<Vector2>();
  static Vector2 getDefault() {
    if (_defaultInstance == null) _defaultInstance = new _ReadonlyVector2();
    return _defaultInstance;
  }
  static Vector2 _defaultInstance;

  double get x => getField(1);
  void set x(double v) { setField(1, v); }
  bool hasX() => hasField(1);
  void clearX() => clearField(1);

  double get y => getField(2);
  void set y(double v) { setField(2, v); }
  bool hasY() => hasField(2);
  void clearY() => clearField(2);
}

class _ReadonlyVector2 extends Vector2 with ReadonlyMessageMixin {}

class Entity_Movable extends GeneratedMessage {
  static final BuilderInfo _i = new BuilderInfo('Entity_Movable')
    ..a(1, 'canMove', GeneratedMessage.OB)
    ..a(2, 'rotationSpeed', GeneratedMessage.OD)
    ..a(3, 'acceleration', GeneratedMessage.OM, Vector2.getDefault, Vector2.create)
    ..a(4, 'velocity', GeneratedMessage.OM, Vector2.getDefault, Vector2.create)
  ;

  Entity_Movable() : super();
  Entity_Movable.fromBuffer(List<int> i, [ExtensionRegistry r = ExtensionRegistry.EMPTY]) : super.fromBuffer(i, r);
  Entity_Movable.fromJson(String i, [ExtensionRegistry r = ExtensionRegistry.EMPTY]) : super.fromJson(i, r);
  Entity_Movable clone() => new Entity_Movable()..mergeFromMessage(this);
  BuilderInfo get info_ => _i;
  static Entity_Movable create() => new Entity_Movable();
  static PbList<Entity_Movable> createRepeated() => new PbList<Entity_Movable>();
  static Entity_Movable getDefault() {
    if (_defaultInstance == null) _defaultInstance = new _ReadonlyEntity_Movable();
    return _defaultInstance;
  }
  static Entity_Movable _defaultInstance;

  bool get canMove => getField(1);
  void set canMove(bool v) { setField(1, v); }
  bool hasCanMove() => hasField(1);
  void clearCanMove() => clearField(1);

  double get rotationSpeed => getField(2);
  void set rotationSpeed(double v) { setField(2, v); }
  bool hasRotationSpeed() => hasField(2);
  void clearRotationSpeed() => clearField(2);

  Vector2 get acceleration => getField(3);
  void set acceleration(Vector2 v) { setField(3, v); }
  bool hasAcceleration() => hasField(3);
  void clearAcceleration() => clearField(3);

  Vector2 get velocity => getField(4);
  void set velocity(Vector2 v) { setField(4, v); }
  bool hasVelocity() => hasField(4);
  void clearVelocity() => clearField(4);
}

class _ReadonlyEntity_Movable extends Entity_Movable with ReadonlyMessageMixin {}

class Entity_Checkpoint extends GeneratedMessage {
  static final BuilderInfo _i = new BuilderInfo('Entity_Checkpoint')
    ..a(1, 'state', GeneratedMessage.Q3)
  ;

  Entity_Checkpoint() : super();
  Entity_Checkpoint.fromBuffer(List<int> i, [ExtensionRegistry r = ExtensionRegistry.EMPTY]) : super.fromBuffer(i, r);
  Entity_Checkpoint.fromJson(String i, [ExtensionRegistry r = ExtensionRegistry.EMPTY]) : super.fromJson(i, r);
  Entity_Checkpoint clone() => new Entity_Checkpoint()..mergeFromMessage(this);
  BuilderInfo get info_ => _i;
  static Entity_Checkpoint create() => new Entity_Checkpoint();
  static PbList<Entity_Checkpoint> createRepeated() => new PbList<Entity_Checkpoint>();
  static Entity_Checkpoint getDefault() {
    if (_defaultInstance == null) _defaultInstance = new _ReadonlyEntity_Checkpoint();
    return _defaultInstance;
  }
  static Entity_Checkpoint _defaultInstance;

  int get state => getField(1);
  void set state(int v) { setField(1, v); }
  bool hasState() => hasField(1);
  void clearState() => clearField(1);
}

class _ReadonlyEntity_Checkpoint extends Entity_Checkpoint with ReadonlyMessageMixin {}

class Entity_RacePortal extends GeneratedMessage {
  static final BuilderInfo _i = new BuilderInfo('Entity_RacePortal')
    ..m(1, 'positions', Entity.create, Entity.createRepeated)
  ;

  Entity_RacePortal() : super();
  Entity_RacePortal.fromBuffer(List<int> i, [ExtensionRegistry r = ExtensionRegistry.EMPTY]) : super.fromBuffer(i, r);
  Entity_RacePortal.fromJson(String i, [ExtensionRegistry r = ExtensionRegistry.EMPTY]) : super.fromJson(i, r);
  Entity_RacePortal clone() => new Entity_RacePortal()..mergeFromMessage(this);
  BuilderInfo get info_ => _i;
  static Entity_RacePortal create() => new Entity_RacePortal();
  static PbList<Entity_RacePortal> createRepeated() => new PbList<Entity_RacePortal>();
  static Entity_RacePortal getDefault() {
    if (_defaultInstance == null) _defaultInstance = new _ReadonlyEntity_RacePortal();
    return _defaultInstance;
  }
  static Entity_RacePortal _defaultInstance;

  List<Entity> get positions => getField(1);
}

class _ReadonlyEntity_RacePortal extends Entity_RacePortal with ReadonlyMessageMixin {}

class Entity extends GeneratedMessage {
  static final BuilderInfo _i = new BuilderInfo('Entity')
    ..a(1, 'type', GeneratedMessage.Q3)
    ..a(2, 'id', GeneratedMessage.Q3)
    ..a(3, 'displayName', GeneratedMessage.OS)
    ..a(4, 'position', GeneratedMessage.QM, Vector2.getDefault, Vector2.create)
    ..a(5, 'orientation', GeneratedMessage.QD)
    ..a(6, 'radius', GeneratedMessage.QD)
    ..a(7, 'movable', GeneratedMessage.OM, Entity_Movable.getDefault, Entity_Movable.create)
    ..a(8, 'checkpoint', GeneratedMessage.OM, Entity_Checkpoint.getDefault, Entity_Checkpoint.create)
    ..a(9, 'racePortal', GeneratedMessage.OM, Entity_RacePortal.getDefault, Entity_RacePortal.create)
  ;

  Entity() : super();
  Entity.fromBuffer(List<int> i, [ExtensionRegistry r = ExtensionRegistry.EMPTY]) : super.fromBuffer(i, r);
  Entity.fromJson(String i, [ExtensionRegistry r = ExtensionRegistry.EMPTY]) : super.fromJson(i, r);
  Entity clone() => new Entity()..mergeFromMessage(this);
  BuilderInfo get info_ => _i;
  static Entity create() => new Entity();
  static PbList<Entity> createRepeated() => new PbList<Entity>();
  static Entity getDefault() {
    if (_defaultInstance == null) _defaultInstance = new _ReadonlyEntity();
    return _defaultInstance;
  }
  static Entity _defaultInstance;

  int get type => getField(1);
  void set type(int v) { setField(1, v); }
  bool hasType() => hasField(1);
  void clearType() => clearField(1);

  int get id => getField(2);
  void set id(int v) { setField(2, v); }
  bool hasId() => hasField(2);
  void clearId() => clearField(2);

  String get displayName => getField(3);
  void set displayName(String v) { setField(3, v); }
  bool hasDisplayName() => hasField(3);
  void clearDisplayName() => clearField(3);

  Vector2 get position => getField(4);
  void set position(Vector2 v) { setField(4, v); }
  bool hasPosition() => hasField(4);
  void clearPosition() => clearField(4);

  double get orientation => getField(5);
  void set orientation(double v) { setField(5, v); }
  bool hasOrientation() => hasField(5);
  void clearOrientation() => clearField(5);

  double get radius => getField(6);
  void set radius(double v) { setField(6, v); }
  bool hasRadius() => hasField(6);
  void clearRadius() => clearField(6);

  Entity_Movable get movable => getField(7);
  void set movable(Entity_Movable v) { setField(7, v); }
  bool hasMovable() => hasField(7);
  void clearMovable() => clearField(7);

  Entity_Checkpoint get checkpoint => getField(8);
  void set checkpoint(Entity_Checkpoint v) { setField(8, v); }
  bool hasCheckpoint() => hasField(8);
  void clearCheckpoint() => clearField(8);

  Entity_RacePortal get racePortal => getField(9);
  void set racePortal(Entity_RacePortal v) { setField(9, v); }
  bool hasRacePortal() => hasField(9);
  void clearRacePortal() => clearField(9);
}

class _ReadonlyEntity extends Entity with ReadonlyMessageMixin {}

