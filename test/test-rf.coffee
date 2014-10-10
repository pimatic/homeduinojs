Board = require('../index').Board

board = new Board("serialport", {
  serialDevice: '/dev/ttyUSB0', 
  baudrate: 115200
})

board.on "rfReceive", (event) -> 
  console.log 'received:', event.pulseLengths, event.pulses

board.on "rf", (event) -> 
  console.log "#{event.protocol}: ", event.values

board.connect().then( ->
  console.log "board ready"
  return board.rfControlStartReceiving(0).then( ->
    console.log "receiving..."
  )
  #.then( ->
  #  board.rfControlSendMessage(4, 'switch1', {id: 9390234, all: false, unit: 0, state: true})
  #)
).done()