///
//  Generated code. Do not modify.
///
library net_movement_input;

import 'package:protobuf/protobuf.dart';

class MovementInput extends GeneratedMessage {
  static final BuilderInfo _i = new BuilderInfo('MovementInput')
    ..a(1, 'accelerationFactor', GeneratedMessage.OD)
    ..a(2, 'newOrientation', GeneratedMessage.OD)
    ..a(3, 'rotationSpeed', GeneratedMessage.OD)
    ..hasRequiredFields = false
  ;

  MovementInput() : super();
  MovementInput.fromBuffer(List<int> i, [ExtensionRegistry r = ExtensionRegistry.EMPTY]) : super.fromBuffer(i, r);
  MovementInput.fromJson(String i, [ExtensionRegistry r = ExtensionRegistry.EMPTY]) : super.fromJson(i, r);
  MovementInput clone() => new MovementInput()..mergeFromMessage(this);
  BuilderInfo get info_ => _i;
  static MovementInput create() => new MovementInput();
  static PbList<MovementInput> createRepeated() => new PbList<MovementInput>();
  static MovementInput getDefault() {
    if (_defaultInstance == null) _defaultInstance = new _ReadonlyMovementInput();
    return _defaultInstance;
  }
  static MovementInput _defaultInstance;

  double get accelerationFactor => getField(1);
  void set accelerationFactor(double v) { setField(1, v); }
  bool hasAccelerationFactor() => hasField(1);
  void clearAccelerationFactor() => clearField(1);

  double get newOrientation => getField(2);
  void set newOrientation(double v) { setField(2, v); }
  bool hasNewOrientation() => hasField(2);
  void clearNewOrientation() => clearField(2);

  double get rotationSpeed => getField(3);
  void set rotationSpeed(double v) { setField(3, v); }
  bool hasRotationSpeed() => hasField(3);
  void clearRotationSpeed() => clearField(3);
}

class _ReadonlyMovementInput extends MovementInput with ReadonlyMessageMixin {}

