events = require 'events'

SerialPort = require("serialport")
Delimiter = SerialPort.parsers.Delimiter

Promise = require 'bluebird'
Promise.promisifyAll(SerialPort.prototype)


class SerialPortDriver extends events.EventEmitter

  constructor: (protocolOptions)->
    super()
    @serialPort = new SerialPort(protocolOptions.serialDevice, {
      baudRate: protocolOptions.baudrate,
      autoOpen: false
    })

  _open: () ->
    unless @serialPort.isOpen
      @serialPort.openAsync()
    else
      Promise.resolve()

  connect: (timeout, retries) ->
    resolver = null
    @ready = no
    @serialPort.removeAllListeners('error')
    @serialPort.removeAllListeners('data')
    @serialPort.removeAllListeners('close')
    @parser.removeAllListeners('data') if @parser?

    @serialPort.on('error', (error) => @emit('error', error) )
    @serialPort.on('close', =>
      @serialPort.removeAllListeners('data')
      @serialPort.removeAllListeners('close')
      @emit 'close'
    )
    @parser = @serialPort.pipe(new Delimiter({ delimiter: '\r\n', encoding: 'ascii' }))

    # setup data listener
    @parser.on("data", (data) =>
      # Sanitize data
      line = data.replace(/\0/g, '').trim()
      @emit('data', line)
      readyLine = line.match(/ready(?: ([a-z]+)-([0-9]+\.[0-9]+\.[0-9]+))?/)
      if readyLine?
        @ready = yes
        @emit 'ready', {tag: readyLine[1], version: readyLine[2]}
      else
        unless @ready
          # got, data but was not ready => reset
          @serialPort.writeAsync("RESET\n").catch( (error) -> @emit("error", error) )
        else
          @emit('line', line)
    )

    return new Promise( (resolve, reject) =>
      resolver = resolve
      @_open().then(() =>
        Promise.delay(1000).then( =>
          # write ping to force reset (see data listener) if device was not reset probably
          @serialPort.writeAsync("PING\n").catch(reject)
          @once("ready", resolver)
        )
      ).catch(reject)
    ).timeout(timeout).catch( (err) =>
      @removeListener("ready", resolver)
      @serialPort.removeAllListeners('data')
      if err.name is "TimeoutError" and retries > 0
        @emit 'reconnect', err
        # try to reconnect
        return @connect(timeout, retries-1)
      else
        throw err
    )

  disconnect: -> @serialPort.closeAsync()

  write: (data) -> @serialPort.writeAsync(data)

module.exports = SerialPortDriver