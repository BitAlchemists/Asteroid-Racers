v0.6 - 
------

+ Add Favicon
+ Add Window class, add UIHelper static class
+ Add UI visibility toggle
+ Fixed Dart-JS source maps import

v0.5 - 2014-06-06
-----------------

Lots of improvements on the race controller. Start and finish. Arrows :)

There are now technical triggers (called RacePortal) that will add you to a game.

+ iterate on RaceController
	+ addStart & addFinish method
	+ logic to allow players to finish a race
+ add teleport player logic
+ players spawn in spawn orientation
+ introduce subtypes of Entity, especially Movable
+ new render objects:
	+ add start zone
	+ add finish zone
	+ add arrows
+ fix offset errors in generateAsteroidBelt and spawnPlayer
+ refactored collision detection

Known Issues:
- Particle effects do not replicate
- first message on chat does not appear
- z index of explosions not correct. they are children of the entity that is exploding and when an entity that was added later is above it, the explosion is behind the other entity
- chat window needs to be readded to the game

v0.4 - 2014-05-31
-----------------

This release adds a lot of depth to the game. 

There is now a checkpoint system that adds the possibility to fly routes thru the asteroid belt. If you crash into an asteroid, you will respawn at the last reached checkpoint. The ship is now smoother to navigate with doe to better input handling.

There is also a richer background with two parallax layers, the sun, the earth and a nearby satellite. Asteroids got a little makeover. The game now shines in fullscreen mode and provides native UI controls.

+ added sun to star background
+ add second parallax layer
  + added earth
  + added satellite
+ custom UI elements
+ better spaceship control
+ particle effect for spaceship
+ fullscreen
+ checkpoint system
  + order in which they have to be touched
  + respawn on checkpoints


Milestone 2
===========
v0.3 - 2014-05-28
-----------------

Ships can now collide with asteroids and other ships and will explode. Some beauty is added with a background star field that has a parallax effect.

+ add heart beat to server
+ add collision detection
  + debug field to show collision areas
  + explosion animation
  + players respawn after a collision
+ add fps counter
+ add star background with parallax effect
+ improved performance but removing unneeded color commands


Known Issues:
- first message on chat does not appear
- slow on Acer Aspire One
- z index of explosions not correct. they are children of the entity that is exploding and when an entity that was added later is above it, the explosion is behind the other entity


v0.2 - 2014-05-23
-----------------

This version provides a more polished version of 0.1 and mainly focused on infrastructure.

Changelog:
+ players may select a username before connecting
  + player names are shown next to the model
  + give a random username if the user does not provide one
+ show own coordinates to allow coordination of players

+ disconnecting/reconnecting now supported
  + connect/disconnect buttons
+ remove disconnected players
+ colorful asteroids
~ only notify the server of position updates when they actually happen
  This reduces a bit of server load, but not much. Since when the player starts moving, these are happening all of the time.
~ make chat work again
~ make console logging on client work

Known Issues: 
- The coordinate system shown ist that of typical 2D graphics libraries with the positive y-axis extending downwards. I want it the other way.


Milestone 1
===========
v0.1 - 2014-05-22
-----------------

This version allows you to run a server, where multiple players can connect to and see each other move around.

+ Multiple Players connecting to the same server
+ moving around
+ seeing each other move around

Known Issues:
- Players are sometimes beeing cloned 
