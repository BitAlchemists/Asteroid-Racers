part of game_client;

class ModuleConfig {
  int xBlocks;
  int yBlocks;
  List<int> topConnectors = [];
  List<int> bottomConnectors = [];
  List<int> leftConnectors = [];
  List<int> rightConnectors = [];
  
  ModuleConfig(this.xBlocks, this.yBlocks, this.topConnectors, this.bottomConnectors, this.leftConnectors, this.rightConnectors);
  
  static final ModuleConfig SMALL_NODE = new ModuleConfig(1,1,[0],[0],[0],[0]);
  static final ModuleConfig MEDIUM_NODE_HORIZONTAL = new ModuleConfig(9, 1, [1,3,5,7],[1,3,5,7],[0],[0]);
  static final ModuleConfig MEDIUM_CONTAINER_HORIZONTAL = new ModuleConfig(6,1,[],[],[0],[0]);
  static final ModuleConfig MEDIUM_CONTAINER_VERTICAL = new ModuleConfig(1,6,[0],[0],[],[]);
  static final ModuleConfig SMALL_CONTAINER_VERTICAL = new ModuleConfig(1,3,[0],[0],[],[]);
  static final ModuleConfig LARGE_CONTAINER_VERTICAL = new ModuleConfig(3,6,[0,2],[0,2],[],[]);
}

class StationModule {
  ModuleConfig config;
  int xPos;
  int yPos;
  var strokeColor;
  var fillColor;
  
  StationModule(this.config, this.xPos, this.yPos, [this.strokeColor=stagexl.Color.Gray, this.fillColor=stagexl.Color.LightGray]);
}

class StationBuilder {

  static double blockLength = 40.0;
  static double blockInset = blockLength / 8;
  static double connectorLength = blockLength / 2;
  
  
  
  static stagexl.Sprite sampleStation(){
    var strokeColorCenter = stagexl.Color.LightGray;
    var fillColorCenter = stagexl.Color.NavajoWhite;

    var strokeColorTop = stagexl.Color.LightSteelBlue;
    var fillColorTop = stagexl.Color.DarkSlateBlue;

    var strokeColorBottom = stagexl.Color.LightGoldenrodYellow;
    var fillColorBottom = stagexl.Color.DarkOrange;

    //main module
    var m1 = new StationModule(ModuleConfig.MEDIUM_NODE_HORIZONTAL, 0, 0, strokeColorCenter, fillColorCenter);
    var m2 = new StationModule(ModuleConfig.SMALL_NODE, 9, 0, strokeColorCenter, fillColorCenter);
    var m3 = new StationModule(ModuleConfig.MEDIUM_NODE_HORIZONTAL, 10, 0, strokeColorCenter, fillColorCenter);

    //modules left
    // left down
    var m4 = new StationModule(ModuleConfig.MEDIUM_CONTAINER_VERTICAL, 1, 1, strokeColorBottom, fillColorBottom);
    // left up
    var m5 = new StationModule(ModuleConfig.MEDIUM_CONTAINER_VERTICAL, 5, -6, strokeColorTop, fillColorTop);
    var m6 = new StationModule(ModuleConfig.SMALL_CONTAINER_VERTICAL, 3, -3, strokeColorTop, fillColorTop);

    //modules right
    // right down
    var m7 = new StationModule(ModuleConfig.SMALL_CONTAINER_VERTICAL, 15, 1, strokeColorBottom, fillColorBottom);
    var m8 = new StationModule(ModuleConfig.SMALL_CONTAINER_VERTICAL, 17, 1, strokeColorBottom, fillColorBottom);
    //right up
    var m9 = new StationModule(ModuleConfig.SMALL_CONTAINER_VERTICAL, 17, -3, strokeColorTop, fillColorTop);
    var m10 = new StationModule(ModuleConfig.LARGE_CONTAINER_VERTICAL, 11, -6, strokeColorTop, fillColorTop);
    
    stagexl.Sprite station = render([m1, m2, m3, m4, m5, m6, m7, m8, m9, m10]);
    station.applyCache(-1000, -1000, 2000, 2000);
    return station;
  }
  
  
  static stagexl.Sprite render(List<StationModule> modules){
    stagexl.Sprite station = new stagexl.Sprite();
    
    for(StationModule instance in modules){
      stagexl.Sprite module = makeModule(instance);
      station.addChild(module);
    }
    
    return station;
  }
  
  static stagexl.Sprite makeModule(StationModule instance){
    stagexl.Sprite station = new stagexl.Sprite();
    double outerWidth = blockLength * instance.config.xBlocks;
    double innerWidth = outerWidth - 2 * blockInset;
    
    double outerHeight = blockLength * instance.config.yBlocks;
    double innerHeight = outerHeight - 2 * blockInset;
    
    double x = instance.xPos * blockLength;
    double y = instance.yPos * blockLength;

    int strokeColor = instance.strokeColor;
    int fillColor = instance.fillColor;
    
    //body
    _applyRect(x + blockInset, y + blockInset, x + blockInset + innerWidth, y + blockInset + innerHeight, station.graphics);
    station.graphics.strokeColor(strokeColor, 1, "round");
    station.graphics.fillColor(fillColor);

    for(int i in instance.config.topConnectors){
      _horizontalConnector(x + blockLength * (i + 0.5), y + blockInset/2, station.graphics);
      station.graphics.strokeColor(strokeColor, 1, "round");
      station.graphics.fillColor(fillColor);
    }

    for(int i in instance.config.topConnectors){
      _horizontalConnector(x + blockLength * (i + 0.5), y + outerHeight - blockInset/2, station.graphics);
      station.graphics.strokeColor(strokeColor, 1, "round");
      station.graphics.fillColor(fillColor);
    }

    for(int i in instance.config.leftConnectors){
      _verticalConnector(x + blockInset/2, y + blockLength * (i + 0.5) , station.graphics);
      station.graphics.strokeColor(strokeColor, 1, "round");
      station.graphics.fillColor(fillColor);
    }
    
    for(int i in instance.config.rightConnectors){
      _verticalConnector(x + outerWidth - blockInset/2, y + blockLength * (i + 0.5), station.graphics);
      station.graphics.strokeColor(strokeColor, 1, "round");
      station.graphics.fillColor(fillColor);
    }
    
    return station;
  }

  static _applyRect(x1, y1, x2, y2, graphics){
    graphics.beginPath();
    graphics.moveTo(x1, y1);
    graphics.lineTo(x2, y1);
    graphics.lineTo(x2, y2);
    graphics.lineTo(x1, y2);
    graphics.lineTo(x1, y1);
    graphics.closePath();      
  }

  static _horizontalConnector(x,y,graphics) => _applyRect(
      x -(blockLength-connectorLength)/2, 
      y - blockInset/2,
      x + (blockLength-connectorLength)/2,
      y + blockInset/2, 
      graphics);
  
  static _verticalConnector(x, y, graphics) => _applyRect(
        x - blockInset/2, 
        y -(blockLength-connectorLength)/2, 
        x + blockInset/2, 
        y + (blockLength-connectorLength)/2, 
        graphics);

}