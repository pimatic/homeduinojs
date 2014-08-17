Board = require('../index').Board

board = new Board('/dev/ttyUSB0', 115200)

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