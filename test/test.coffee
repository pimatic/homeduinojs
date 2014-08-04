Board = require('../index').Board

board = new Board('/dev/ttyUSB0', 9600)

board.connect().then( ->
  board.digitalWrite(4, 1)
    .then( -> console.log "digitalWrite done" )
    .then( -> board.readDHT(22, 13) )
    .then( (ret) -> console.log ret )
).done()