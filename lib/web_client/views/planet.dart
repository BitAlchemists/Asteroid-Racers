part of web_client;

class Planet extends stagexl.Sprite {
  
  factory Planet.random([num radius = 100]){
    int waterColor = RenderHelper.randColor(128, 256);
    int landColor = RenderHelper.randColor(256, 512);
    return new Planet(radius, waterColor, landColor);
  }
  
  Planet(num radius, int baseColor, int layerColor, {int continentalFragments: 10}){
    graphics.rect(-radius, -radius, radius*2, radius*2);
    graphics.fillColor(baseColor);
    
    for(int i = 0; i < continentalFragments; i++){
      num outerRadius = 60;
      num innerRadius = 20;
      num numVertices = 7;
      int xPos = radius - random.nextInt(radius*2);
      int yPos = radius - random.nextInt(radius*2);
      RenderHelper.applyCobweb(graphics, outerRadius, innerRadius, numVertices, x:xPos, y:yPos);
      graphics.fillColor(layerColor);      
    }
    mask = new stagexl.Mask.circle(0, 0, radius);
    applyCache(-radius, -radius, radius*2, radius*2);
  }
}