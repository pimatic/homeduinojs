homeduinojs
===========

Node.js library for using [homeduino](https://github.com/sweetpi/homeduino).

API
---

### connect

```CoffeeScript

Board = require('../index').Board
board = new Board('/dev/ttyUSB0', 9600)

board.connect().then( ->
  #do stuff
).done()
```

### readDHT(type, pin)

Read a dht sensor

```CoffeeScript
board.readDHT(22, 13).then( (ret) -> 
  console.log ret.temperature, ret.humidity
).done()
```

### readDHT(type, pin)

Read a dht sensor

```CoffeeScript
board.readDHT(22, 13).then( (ret) -> 
  console.log ret.temperature, ret.humidity
).done()
```


### rfControlStartReceiving(pin)

```CoffeeScript

board.on "rfReceive", (event) -> 
  console.log 'received:', event.pulseLengths, event.pulses

board.on "rf", (event) -> 
  console.log "#{event.protocol}: ", event.values

board.connect().then( ->
  console.log "board ready"
  board.rfControlStartReceiving(0).then( ->
    console.log "receiving..."
  ).done()
).done()
```

### pin read and writes

```CoffeeScript
board.digitalWrite(4, 1).done()
board.analogWrite(1, 10).done()
board.digitalRead(4).then( (value) ->
  console.log value
).done()
board.analogRead(4).then( (value) ->
  console.log value
).done()
board.pinMode(1, 0).done()
```