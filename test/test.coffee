Board = require('../index').Board

board = new Board('/dev/ttyUSB0', 9600)

board.on "keypad", (event) -> console.log event
board.on "rfReceive", (event) -> console.log event

board.connect().then( ->
  time = (new Date()).getTime()
  board.digitalWrite(4, 1)
    .then( -> 
      timeDelta = (new Date().getTime() - time);
      console.log "digitalWrite done, took #{timeDelta}ms" )
    .done()
  setInterval( (->
    time = (new Date()).getTime()
    board.readDHT(22, 13).then( (ret) -> 
      timeDelta = (new Date().getTime() - time);
      console.log ret, "took: #{timeDelta}ms").done()
  ), 2000)

).done()