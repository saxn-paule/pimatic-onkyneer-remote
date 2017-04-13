var __bind = function (fn, me) {
    return function () {
      return fn.apply(me, arguments);
    };
  },
  __hasProp = {}.hasOwnProperty,
  __extends = function (child, parent) {
    for (var key in parent) {
      if (__hasProp.call(parent, key)) child[key] = parent[key];
    }
    function ctor() {
      this.constructor = child;
    }

    ctor.prototype = parent.prototype;
    child.prototype = new ctor();
    child.__super__ = parent.prototype;
    return child;
  };

module.exports = function (env) {
  var M, OnkyneerRemotePlugin, OnkyneerRemoteActionProvider, OnkyneerRemoteActionHandler, OnkyneerRemotePlugin, onkyo, pluginConfig, connected;
  M = env.matcher;

  var Promise = env.require('bluebird');
  var net = env.require('net');
  var util = env.require('util');
  var assert = env.require('cassert');

  /**
   * Default connection parameters
   **/
  var defaultHost = '192.168.0.15';
  var defaultMaxVolume = 98;

  var currentVolume = 0;
  var currentDisplay = 'Not implemented yet';
  var currentStatus = 0;
  var currentInput = '';
  var updateInterval = 2000;

  var Onkyo = require("onkyo.js");

  /**
   * THE PLUGIN ITSELF
   **/
  OnkyneerRemotePlugin = (function (_super) {
    __extends(OnkyneerRemotePlugin, _super);

    function OnkyneerRemotePlugin() {
      this.init = __bind(this.init, this);
      return OnkyneerRemotePlugin.__super__.constructor.apply(this, arguments);
    }

    OnkyneerRemotePlugin.prototype.init = function (app, framework, config) {
      var deviceConfigDef;
      this.framework = framework;
      this.config = config;
      pluginConfig = config;
      this.framework.ruleManager.addActionProvider(new OnkyneerRemoteActionProvider(this.framework));

      deviceConfigDef = require("./device-config-schema");

      this.framework.deviceManager.registerDeviceClass("OnkyneerSensor", {
        configDef: deviceConfigDef.OnkyneerSensor,
        createCallback: (function (_this) {
          return function (config) {
            return new OnkyneerSensor(config, framework);
          };
        })(this)
      });
    };

    return OnkyneerRemotePlugin;

  })(env.plugins.Plugin);

  OnkyneerRemotePlugin = new OnkyneerRemotePlugin;
  /**
   * THE ACTION PROVIDER
   **/
  OnkyneerRemoteActionProvider = (function (_super) {
    __extends(OnkyneerRemoteActionProvider, _super);

    function OnkyneerRemoteActionProvider(framework, config) {
      this.framework = framework;
      this.config = config;
      this.connectAction = __bind(this.connectAction, this);
    }

    /**
     *This function handles action in the form of `sendOnkyneer "some string"`
     **/

    OnkyneerRemoteActionProvider.prototype.parseAction = function (input, context) {
      var commandTokens, fullMatch, m, match, onEnd, retVal, setCommand;
      retVal = null;
      commandTokens = null;
      fullMatch = false;
      setCommand = (function (_this) {
        return function (m, tokens) {
          return commandTokens = tokens;
        };
      })(this);

      onEnd = (function (_this) {
        return function () {
          return fullMatch = true;
        };
      })(this);

      m = M(input, context).match("sendOnkyneer ").matchStringWithVars(setCommand);
      if (m.hadMatch()) {
        match = m.getFullMatch();
        return {
          token: match,
          nextInput: input.substring(match.length),
          actionHandler: new OnkyneerRemoteActionHandler(this.framework, commandTokens)
        };
      } else {
        return null;
      }
    };

    return OnkyneerRemoteActionProvider;

  })(env.actions.ActionProvider);

  /**
   * THE ACTION HANDLER
   **/

  OnkyneerRemoteActionHandler = (function (_super) {
    __extends(OnkyneerRemoteActionHandler, _super);

    function OnkyneerRemoteActionHandler(framework, commandTokens) {
      this.framework = framework;
      this.commandTokens = commandTokens;
      this.executeAction = __bind(this.executeAction, this);
      this.connect = __bind(this.connect, this);
      this.disconnect = __bind(this.disconnect, this);
      this.sendCommand = __bind(this.sendCommand, this);
    }

    /**
     * Method for establishing connection to the receiver
     **/
    OnkyneerRemoteActionHandler.prototype.connect = function (command) {

      env.logger.info('Connect method called.');

      var _this = this;

      if (!connected) {
        onkyo.on("error", function(err){
          console.log(err);
        });

        onkyo.on("detected", function(device){
          console.log(device);
        });

        onkyo.on("msg", function(msg){
          _this.handleData(msg);
        });

        onkyo.on("connected", function(host){
          console.log("connected to: "+JSON.stringify(host));
          connected = true;
        });

        onkyo.Connect(function(error, ok){
          if(!error) {
            env.logger.info('Connection successful.');

            if(command) {
              _this.sendCommand(command);
            }
          } else {
            return 'Error while establishing connection';
          }
        });
      }

      return 'done';
    };

    /**
     * Method to call when connection isn't needed any longer
     **/
    OnkyneerRemoteActionHandler.prototype.disconnect = function () {
      if (onkyo && connected) {
	      onkyo.Close(function(error, ok){
          if(!error) {
			      env.logger.info('Disconnected');
			      connected = false;
		      }
		    });

        return 'disconnected';
      } else {
	        if(logLevel === "info") {
            env.logger.info('Nothing to disconnect from.');
		      }
      }

      return 'disconnected';
    };

    /**
     * Method for sending a command
     **/
    OnkyneerRemoteActionHandler.prototype.sendCommand = function (command) {

      var splittedCommand = command.split('\.');
      var category = splittedCommand[0];
      var func = splittedCommand[1];

      var maxVolume = pluginConfig.maxVolume || defaultMaxVolume;

      var volLevel = (currentVolume + 80.5) * 2;
      var value = '';

      /**
       * Handle max volume to avoid damage on user and equipment
      **/

      if(!onkyo) {
        env.logger.info('no onkyo...creating one');
        var host = pluginConfig.host ? pluginConfig.host : defaultHost;

        env.logger.info('Host: ' + host);

        onkyo = Onkyo.init({
          "log": true,
          "ip": host
        });
      }

      if(!connected) {
        env.logger.info('Not connected yet, establish new connection');
        this.connect(command);
      }

      onkyo.SendCommand(category, func, function(error, ok){
        if(!error) {
          return 'Sent command: ' + command;
        } else {
          return 'Error while sending command: ' + command;
        }
      });
    };

    /**
     * Handle the incoming data
     **/
    OnkyneerRemoteActionHandler.prototype.handleData = function (dataObj) {


      if(dataObj) {
        if (typeof dataObj == 'string' || dataObj instanceof String) {
          try {
            dataObj = JSON.parse(dataObj);
          } catch(e) {
            // something went wrong
          }
        }

        var key = Object.keys(dataObj)[0];
        var value = dataObj[key];

        switch (key) {
          case "MVL":
            currentVolume = value;
          case "PWR":
            if (value) {
              currentStatus = 1;
            } else {
              currentStatus = 0;
            }
          case "AMT":

          case "IFA":

          case "SLI":

          default:
          //Do nothing
        }
      }
    };

    /**
     * This function handles action in the form of `sendOnkyneer "command"`
     **/
    OnkyneerRemoteActionHandler.prototype.executeAction = function () {
      return this.framework.variableManager.evaluateStringExpression(this.commandTokens).then((function (_this) {
        return function (command) {
          switch (command) {
            case 'connect':
              return _this.connect();
              break;
            case 'disconnect':
              return _this.disconnect();
              break;
            default:
              return _this.sendCommand(command);
          }
        };
      })(this));
    };

    return OnkyneerRemoteActionHandler;

  })(env.actions.ActionHandler);

  onkyneerRemoteActionHandler = new OnkyneerRemoteActionHandler;

  /**
   * THE AVR SENSOR
   **/
  OnkyneerSensor = (function (_super) {
    __extends(OnkyneerSensor, _super);

    function OnkyneerSensor(config, framework) {
      var attr;
      this.config = config;
      this.id = config.id;
      this.name = config.name;
      this.attributes = {};
	    this.intervalTimeoutObject = null;

      var func = (function (_this) {
        return function (attr) {
          var name = attr.name;

          assert(name === 'vol' || name === 'display' || name === 'status');

          switch (name) {
            case 'vol':
              _this.attributes[name] = {
                description: name,
                type: "number"
              };

              var getter = (function () {
                onkyneerRemoteActionHandler.sendCommand('AUDIO.Volume');

                return Promise.resolve(currentVolume);
              });
              _this.attributes[name].unit = 'dB';
              _this.attributes[name].acronym = 'VOL';
              break;
            case 'display':
              _this.attributes[name] = {
                description: name,
                type: "string"
              };

              var getter = (function () {
                /** TODO: Implement **/
                return Promise.resolve(currentDisplay);
              });
              break;
            case 'status':
              _this.attributes[name] = {
                description: name,
                type: "number"
              };

              var getter = (function () {
                onkyneerRemoteActionHandler.sendCommand('POWER.Power STATUS');

				        return Promise.resolve(currentStatus);
              });
              break;  
            default:
              throw new Error("Illegal attribute name: " + name + " in OnkyneerSensor.");
          }

          _this._createGetter(name, getter);		  
		  
          _this.intervalTimeoutObject = setInterval((function () {
            return getter().then(function (value) {
              return _this.emit(name, value);
            })["catch"](function (error) {
              return env.logger.debug(error.stack);
            });
          }), updateInterval);
		  return _this.intervalTimeoutObject;
		  
        };
      })(this);

      for (var i = 0; i < this.config.attributes.length; i++) {
        attr = this.config.attributes[i];
        func(attr);
      }

      OnkyneerSensor.__super__.constructor.call(this);
    }

    return OnkyneerSensor;

  })(env.devices.Sensor);

  OnkyneerSensor.prototype.destroy = function() {
	if (this.intervalTimeoutObject != null) {
	  clearInterval(this.intervalTimeoutObject);
    }
    return OnkyneerSensor.__super__.destroy.call(this);
  };
  
  module.exports.OnkyneerRemoteActionProvider = OnkyneerRemoteActionProvider;

  return OnkyneerRemotePlugin;
};
