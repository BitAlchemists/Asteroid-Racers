Asteroid-Racers
===============

Asteroid Racers is a multiplayer browser game that lets you race against other players with your spaceship in the weightlessness of outer space.

Set up the development environment
----------------------------------
- Download DartEditor from www.dartlang.org.
- Clone the Asteroid-Racers repo
- pub get

There are two ways to test the client locally.

1) The server runs within the browser:
- set config.localServer in web/asteroidracers.dart to true
- run web/asteroidracers.html

2) The server runs as a dedicated application:
- set config.localServer in web/asteroidracers.dart to false
- run bin/run_server.dart to run the server
- run web/asteroidracers.html to run the client

For details visit the wiki: https://github.com/BitAlchemists/Asteroid-Racers/wiki
