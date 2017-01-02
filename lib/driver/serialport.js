var Promise, SerialPort, SerialPortDriver, events,
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

events = require('events');

SerialPort = require("serialport");

Promise = require('bluebird');

Promise.promisifyAll(SerialPort.prototype);

SerialPortDriver = (function(superClass) {
  extend(SerialPortDriver, superClass);

  function SerialPortDriver(protocolOptions) {
    this.serialPort = new SerialPort(protocolOptions.serialDevice, {
      baudrate: protocolOptions.baudrate,
      parser: SerialPort.parsers.readline("\r\n"),
      autoOpen: false
    });
  }

  SerialPortDriver.prototype.connect = function(timeout, retries) {
    this.ready = false;
    this.serialPort.removeAllListeners('error');
    this.serialPort.removeAllListeners('data');
    this.serialPort.removeAllListeners('close');
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
    return this.serialPort.openAsync().then((function(_this) {
      return function() {
        var resolver;
        resolver = null;
        _this.serialPort.on("data", function(data) {
          var line, readyLine;
          line = data.replace(/\0/g, '').trim();
          _this.emit('data', line);
          readyLine = line.match(/ready(?: ([a-z]+)-([0-9]+\.[0-9]+\.[0-9]+))?/);
          if (readyLine != null) {
            _this.ready = true;
            _this.emit('ready', {
              tag: readyLine[1],
              version: readyLine[2]
            });
            return;
          }
          if (!_this.ready) {
            _this.serialPort.writeAsync("RESET\n")["catch"](function(error) {
              return this.emit("error", error);
            });
            return;
          }
          return _this.emit('line', line);
        });
        return new Promise(function(resolve, reject) {
          Promise.delay(1000).then(function() {
            return _this.serialPort.writeAsync("PING\n")["catch"](reject);
          }).done();
          resolver = resolve;
          return _this.once("ready", resolver);
        }).timeout(timeout)["catch"](function(err) {
          _this.removeListener("ready", resolver);
          _this.serialPort.removeAllListeners('data');
          if (err.name === "TimeoutError" && retries > 0) {
            _this.emit('reconnect', err);
            return _this.connect(timeout, retries - 1);
          } else {
            throw err;
          }
        });
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
