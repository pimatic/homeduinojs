events = require 'events'

Promise = require 'bluebird'
spawn = require('child_process').spawn
readline = require 'readline'
path = require 'path'

class GpioDriver extends events.EventEmitter

  constructor: (@protocolOptions)->
    @binary = path.resolve __dirname, '../bin/vhduino'

  connect: (timeout, retries) ->
    # cleanup
    @ready = no
    @vhduino = spawn @binary
    Promise.promisifyAll(@vhduino.stdin)

    readline.createInterface({
      input: @vhduino.stdout
      terminal: false
    }).on('line', (line) =>
      @emit('data', line) 
      if line is "ready"
        @ready = yes
        @emit 'ready'
        return
      @emit('line', line) 
    )

    @vhduino.stderr.on('data',  (data) => @emit('data', data) )
    @vhduino.on('close', (code) => @emit 'close' )
    @vhduino.on('error', (error) => @emit('error', error) )

    return new Promise( (resolve, reject) =>
      @once("ready", resolver)
      @once("error", reject)
    )

  disconnect: -> 
    @vhduino.kill()
    return Promise.resolve()

  write: (data) -> @vhduino.stdin.writeAsyc(data, 'ascii')

module.exports = GpioDriver