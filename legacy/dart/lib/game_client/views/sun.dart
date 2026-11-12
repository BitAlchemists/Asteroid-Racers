part of game_client;

class Sun extends stagexl.Sprite {
  
  Sun(){
    graphics.circle(0, 0, 100);
    stagexl.GraphicsGradient gradient = new stagexl.GraphicsGradient.radial(0,0,0,
                                                                            0,0,100);
    gradient.addColorStop(0.0, stagexl.Color.White);
    gradient.addColorStop(0.3, stagexl.Color.Yellow);
    gradient.addColorStop(0.7, stagexl.Color.Orange);
    gradient.addColorStop(1.0, stagexl.Color.OrangeRed);
    graphics.fillGradient(gradient);
  }
}