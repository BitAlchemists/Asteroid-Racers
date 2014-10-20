Release Checklist
=================

+ Tested in JS
+ Production settings on (server and client)
+ All features work as described in the backlog
+ User manual updated
+ Update branches in Git
+ Create screen shots
+ Write release notes
+ Announce release

Future
======

Epics
-----
# v0.6
+ RaceController & UI

# v0.7
+ Public Viewing Mode

# v0.8
+ User Account System

# v0.9
+ Tutorial

# v1.1
+ Level Loading
+ Level Editor

# v1.2
+ Ladders/Contests

# v1.3
+ Ship Upgrades

# v2.0
+ Fighting

# v3.0
+ Autopilot
+ NPCs
+ Stations
+ Mining
+ Trading
+ Crafting
+ NPC Scripting
+ Merchang Mode


Ideas for Improvements
------------
+ more than one player on one computer
+ Health Bar
  + Health Bar loss on colissions
+ mouse control over ship
+ hide ship during explosion
+ rockets
+ Player colors
+ in station mode
+ collision trigger
+ add zoom in zoom out on mouse button
+ add alternate player controllers (mouse based)
+ show other players directions when they are out of screen
+ show next checkpoints direction in Hud
+ console interpreter
  + respawn
  + warp
+ Server: etags, last-modified-since support

World:
  + npc village
  + black holes
  + giant asteroid
  + mothership
  + space station
  + milky way
  + sternschnuppen
  + star signs
  + Mars in front, Earth in back
  + Moon moves around the world
  + nebula
  + warp portals
  
The Challenges
  + the triangle
  + the reactangle
  + fly around the world
  + level 1
  + pass the asteroid field as fast as possible (best 3 out of 5)
  
Sound
  + Ambient space music
  + Radio sounds
World Builder Mode:
  + race mode
  

Improvements
------------

# Common
~ sanitize message handling

# Client
+ add key buffering like in game_loop library and make it frame-based for more precise control over user input

# Server
~ make server side file logger work again
+ make sure the StaticFileHandler does not expose files out of its baseFolder scope

# Racing Mode
+ create different scene controllers for different playing modes?
+ move control over position to server

