events = require 'events'

Promise = require 'bluebird'
spawn = require('child_process').spawn
readline = require 'readline'
path = require 'path'

class GpioDriver extends events.EventEmitter

  constructor: (@protocolOptions)->
    @binary = path.resolve __dirname, '../../bin/vhduino'
  connect: (timeout, retries) ->
    # cleanup
    @ready = no
    @vhduino = spawn @binary
    readline.createInterface({
      input: @vhduino.stderr
      terminal: false
    }).on('line', (line) =>
      @emit('data', line) 
      if line is "ready"
        @ready = yes
        @emit 'ready', {tag: 'gpio'}
        return
      @emit('line', line) 
   )
    @vhduino.stdout.on('data',  (data) => @emit('data', data.toString()) )
    @vhduino.on('close', (code) => @emit 'close' )
    @vhduino.on('error', (error) => @emit('error', error) )

#    return Promise.resolve()
    return new Promise( (resolve, reject) =>
      @once("ready", resolve)
      @once("error", reject)
    )

  disconnect: -> 
    @vhduino.kill()
    return Promise.resolve()

  write: (data) -> 
    return new Promise( (resolve, reject) => 
      @vhduino.stdin.write(data, 'ascii', (err) => 
        if err? then reject(err) else resolve() 
      )
    )

module.exports = GpioDriver
