Board = require('../index').Board

board = new Board('/dev/ttyUSB0', 9600)

board.on "keypad", (event) -> console.log event
board.on "rfReceive", (event) -> console.log event

board.connect().then( ->
  board.digitalWrite(4, 1)
    .then( -> console.log "digitalWrite done" )
    .done()
  board.readDHT(22, 13)
    .then( (ret) -> console.log ret )
    .done()
  board.rfControlStartReceiving(0)
    .done()
).done()