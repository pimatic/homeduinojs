var Delimiter, Promise, SerialPort, SerialPortDriver, events,
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

events = require('events');

SerialPort = require("serialport");

Delimiter = SerialPort.parsers.Delimiter;

Promise = require('bluebird');

Promise.promisifyAll(SerialPort.prototype);

SerialPortDriver = (function(superClass) {
  extend(SerialPortDriver, superClass);

  function SerialPortDriver(protocolOptions) {
    SerialPortDriver.__super__.constructor.call(this);
    this.serialPort = new SerialPort(protocolOptions.serialDevice, {
      baudRate: protocolOptions.baudrate,
      autoOpen: false
    });
  }

  SerialPortDriver.prototype._open = function() {
    if (!this.serialPort.isOpen) {
      return this.serialPort.openAsync();
    } else {
      return Promise.resolve();
    }
  };

  SerialPortDriver.prototype.connect = function(timeout, retries) {
    var resolver;
    resolver = null;
    this.ready = false;
    this.serialPort.removeAllListeners('error');
    this.serialPort.removeAllListeners('data');
    this.serialPort.removeAllListeners('close');
    if (this.parser != null) {
      this.parser.removeAllListeners('data');
    }
    this.serialPort.on('error', (function(_this) {
      return function(error) {
        return _this.emit('error', error);
      };
    })(this));
    this.serialPort.on('close', (function(_this) {
      return function() {
        _this.serialPort.removeAllListeners('data');
        _this.serialPort.removeAllListeners('close');
        return _this.emit('close');
      };
    })(this));
    this.parser = this.serialPort.pipe(new Delimiter({
      delimiter: '\r\n',
      encoding: 'ascii'
    }));
    this.parser.on("data", (function(_this) {
      return function(data) {
        var line, readyLine;
        line = data.replace(/\0/g, '').trim();
        _this.emit('data', line);
        readyLine = line.match(/ready(?: ([a-z]+)-([0-9]+\.[0-9]+\.[0-9]+))?/);
        if (readyLine != null) {
          _this.ready = true;
          return _this.emit('ready', {
            tag: readyLine[1],
            version: readyLine[2]
          });
        } else {
          if (!_this.ready) {
            return _this.serialPort.writeAsync("RESET\n")["catch"](function(error) {
              return this.emit("error", error);
            });
          } else {
            return _this.emit('line', line);
          }
        }
      };
    })(this));
    return new Promise((function(_this) {
      return function(resolve, reject) {
        resolver = resolve;
        return _this._open().then(function() {
          return Promise.delay(1000).then(function() {
            _this.serialPort.writeAsync("PING\n")["catch"](reject);
            return _this.once("ready", resolver);
          });
        })["catch"](reject);
      };
    })(this)).timeout(timeout)["catch"]((function(_this) {
      return function(err) {
        _this.removeListener("ready", resolver);
        _this.serialPort.removeAllListeners('data');
        if (err.name === "TimeoutError" && retries > 0) {
          _this.emit('reconnect', err);
          return _this.connect(timeout, retries - 1);
        } else {
          throw err;
        }
      };
    })(this));
  };

  SerialPortDriver.prototype.disconnect = function() {
    return this.serialPort.closeAsync();
  };

  SerialPortDriver.prototype.write = function(data) {
    return this.serialPort.writeAsync(data);
  };

  return SerialPortDriver;

})(events.EventEmitter);

module.exports = SerialPortDriver;
