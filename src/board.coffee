Promise = require 'bluebird'
assert = require 'assert'
events = require 'events'
rfcontrol = require 'rfcontroljs'

settled = (promise) -> Promise.settle([promise])

class Board extends events.EventEmitter

  @HIGH=1
  @LOW=0
  @INPUT=0
  @OUTPUT=1
  @INPUT_PULLUP=2

  _awaitingAck: []
  _opened: no
  ready: no

  constructor: (driver, driverOptions) ->
    assert driver in ["serialport", "gpio"]
    # setup a new driver
    switch driver
      when "serialport"
        SerialPortDriver = require './driver/serialport'
        @driver = new SerialPortDriver(driverOptions)
      when "gpio"
        GpioDriver =  require './driver/gpio'
        @driver = new GpioDriver(driverOptions)
    
    @_lastAction = Promise.resolve()
    @driver.on('ready', => 
      @_lastDataTime = new Date().getTime()
      @ready = yes
      @emit('ready') 
    )
    @driver.on('error', (error) => @emit('error', error) )
    @driver.on('reconnect', (error) => @emit('reconnect', error) )
    @driver.on('close', => 
      @ready = no
      @emit('close')
    )
    @driver.on("data", (data) =>
      @emit "data", data
    )
    @driver.on("line", (line) =>
      @emit "line", line
      @_onLine(line)
    )
    @on('ready', => @setupWatchdog())

  connect: (@timeout = 5*60*1000, @retries = 3) -> 
    # Stop watchdog if its running and close current connection
    return @pendingConnect = @driver.connect(timeout, retries)

  disconnect: ->
    @stopWatchdog()
    return @driver.disconnect()

  setupWatchdog: ->
    @stopWatchdog()
    @_watchdogTimeout = setTimeout( (=>
      now = new Date().getTime()
      # last received data is not very old, conncection looks ok:
      if now - @_lastDataTime < @timeout
        @setupWatchdog()
        return
      # Try to send ping, if it failes, there is something wrong...
      @driver.write("PING\n").then( =>
        @setupWatchdog()
      ).timeout(20*1000).catch( (err) =>
        @emit 'reconnect', err
        @connect(@timeout, @retries).catch( (error) =>
          # Could not reconnect, so start watchdog again, to trigger next try
          @emit 'reconnect', err
          return
        )
        return
      )
    ), 20*1000)

  stopWatchdog: ->
    clearTimeout(@_watchdogTimeout)

  _onLine: (line) -> 
    #console.log "data:", JSON.stringify(line)
    @_lastDataTime = new Date().getTime()
    args = line.split(" ")
    assert args.length >= 1
    cmd = args[0]
    args.splice(0, 1)
    #console.log cmd, args
    switch cmd
      when 'ACK', 'ERR' then @_handleAcknowledge(cmd, args)
      when 'RF' then @_handleRFControl(cmd, args)
      when 'KP' then @_handleKeypad(cmd, args)
      when 'PING' then ;#nop
      else console.log "unknown message received: #{line}"
      

  whenReady: -> 
    unless @pendingConnect?
      return Promise.reject(new Error("First call connect!"))
    return @pendingConnect


  writeAndWait: (data) ->
    return @_lastAction = settled(@_lastAction).then( => 
      return Promise.all([@driver.write(data), @_waitForAcknowledge()])
        .then( ([_, result]) -> 
          #console.log "writeAndWait result: ", result
          result )
    )

  digitalWrite: (pin, value) ->
    assert typeof pin is "number"
    assert value in [0, 1]
    return @writeAndWait("DW #{pin} #{value}\n")

  analogWrite: (pin, value) ->
    assert typeof pin is "number"
    assert typeof value is "number"
    return @writeAndWait("AW #{pin} #{value}\n")

  digitalRead: (pin) ->
    assert typeof pin is "number"
    return @writeAndWait("DR #{pin}\n")

  analogRead: (pin) ->
    assert typeof pin is "number"
    return @writeAndWait("AR #{pin}\n")

  pinMode: (pin, mode) ->
    assert typeof pin is "number"
    assert mode in [0, 1, 2]
    return @writeAndWait("PM #{pin} #{mode}\n")    

  readDHT: (type, pin) ->
    assert type in [11, 22, 33, 44, 55]
    assert (typeof pin is "number"), "pin should be a number"
    return @writeAndWait("DHT #{type} #{pin}\n")
      .then( (args) -> 
        #console.log "readDHT args[0]: ", args[0]
        {
          temperature: parseFloat(args[0]), 
          humidity: parseFloat(args[1])
        })

  #DST [pin] sensors -> gets all sensor addresses on that pin
  readDstSensors: (pin)->
    reading = @writeAndWait("DST #{pin} sensors\n")
    promise = reading
      .then( (args) -> 
        #console.log "readDstSensors: ", args
        args.shift()
        {
          sensors: args
        })
    return promise

  #DST [pin] [address] -> single temperature C
  readDstSensor: (pin, address)->
    reading = @writeAndWait("DST #{pin} #{address}\n")
    promise = reading
      .then( (args) -> 
        {
          temperature: parseFloat(args) 
        })
    return promise
  
  #DST [pin] all -> all temperatures on that pin.
  readDstAll: (pin) ->
    reading = @writeAndWait("DST #{pin} all\n")
    promise = reading
      .then( (args) -> 
        {
          temperature: parseFloat(args[0])
        })
    return promise

  rfControlStartReceiving: (pin) ->
    assert (typeof pin is "number"), "pin should be a number"
    return @writeAndWait("RF receive #{pin}\n")

  rfControlSendMessage: (pin, repeats, protocolName, message) ->
    result = rfcontrol.encodeMessage(protocolName, message)
    return @rfControlSendPulses(pin, repeats, result.pulseLengths, result.pulses)

  rfControlSendPulses: (pin, repeats, pulseLengths, pulses) ->
    assert typeof pin is "number", "pin should be a number"
    assert Array.isArray(pulseLengths), "pulseLengths should be an array"
    assert pulseLengths.length <= 8, "pulseLengths.length should be <= 8"
    assert typeof pulses is "string", "pulses should be a string"
    pulseLengthsArgs = ""
    i = 0
    for pl in pulseLengths
      pulseLengthsArgs += " #{pl}"
      i++
    while i < 8
      pulseLengthsArgs += " 0"
      i++
    return @writeAndWait("RF send #{pin} #{repeats} #{pulseLengthsArgs} #{pulses}\n")

  _onAcknowledge: () =>
    return new Promise( (resolve) =>
      @_awaitingAck.push resolve
    )

  _waitForAcknowledge: () =>
    return @_onAcknowledge().then( ( {cmd, args} ) =>
      switch cmd
        when 'ERR' then throw new Error(args[0])
        when 'ACK'
          switch args.length
            when 0 then return
            when 1 then return args[0]
            else return args
        else assert false
    )

  _handleAcknowledge: (cmd, args) ->
    assert @_awaitingAck.length > 0
    resolver = @_awaitingAck[0]
    resolver({cmd, args})
    @_awaitingAck.splice(0, 1)
    return
  
  _handleRFControl: (cmd, args) ->
    unless args.length is 10 and args[0] is 'receive'
      console.log "Unknown RF response \"#{args.join(" ")}\""
      return
    
    strSeq = args[1]
    for a in args[2..9]
      strSeq += " #{a}"

    info = rfcontrol.prepareCompressedPulses(strSeq)
    @emit 'rfReceive', info
    results = rfcontrol.decodePulses(info.pulseLengths, info.pulses)
    for r in results
      @emit 'rf', r
    return

  _handleKeypad: (cmd, args) ->
    assert args.length is 1
    key = args[0]
    @emit 'keypad', {key}
    return

  @getRfProtocol: (protocolName) ->
    return rfcontrol.getProtocol(protocolName)

module.exports = Board
