'use strict';
var express = require('express');
var router = express.Router();
var SerialPort = require('serialport');

/*----------------------------------------------------------------------------*/
router.get('/', function(req, res, next) {
  res.render('colors', Lights.ClientData);
});

router.post('/cycle', function(req, res, next) {
  if (req.body.pattern === 'off') {
    Lights.CycleTimer.stop();
    res.sendStatus(204);
  } else {
    let colorSet = Lights.getColorSet(req.body.pattern);
    if (colorSet.length === 0) {
      res.sendStatus('invalid color set');
    } else {
      Lights.CycleTimer.start(colorSet);
      res.sendStatus(204);
    }
  }
});

router.post('/speed', function(req, res, next) {
  let ms = req.body.ms;
  if (isNaN(ms)) {
    res.sendStatus(400);
  } else {
    Lights.CycleTimer.setInterval(ms);
    res.sendStatus(204);
  }
});

router.post('/brightness', function(req, res, next) {
  let brightness = req.body.brightness;
  if (isNaN(brightness) || brightness < 1 || brightness > 8) {
    res.sendStatus(400);
  } else {
    Lights.IRSequences.brightness(brightness);
    res.sendStatus(204);
  }
});

router.post('/ircommand', function(req, res, next) {
  let result = Lights.sendCommand(req.body.command);
  if (result === null) {
    res.sendStatus(204);
  } else {
    res.send(result);
  }
});

router.post('/hex', function(req, res, next) {
  let result = Lights.sendHexColor(req.body.hexcolor);
  if (result === null) {
    res.sendStatus(204);
  } else {
    res.send(result);
  }
});

module.exports = router;

/*----------------------------------------------------------------------------*/

var IR = new function() {

  // public begins with this.
  this.ready = false;

  //let tty = '/dev/ttyUSB0';
  //let tty = '/dev/ttyAMA0';
  let tty = '/dev/ttyS0';
  console.log('attempting to connect to ' + tty);

  let _port = new SerialPort(tty, {
    baudRate: 9600
  });

  _port.on('open', () =>  {
    console.log('port opened at ' + tty);
    this.ready = true;
  });

  // return null for bad arg
  this.write = (arg) => {
    if (Array.isArray(arg)) {
      arg = Buffer.from(arg);
    } else if (!Buffer.isBuffer(arg)) {
      return null;
    }
    return _port.write(arg);
  };


};

/*----------------------------------------------------------------------------*/

var Lights = new function (){
  // private starts with _
  
  const _ROOT = this;
  const _BRIGHTNESS_INTERVALS = 8;

  // return null for success
  let _send = (ircode) => {
    if (!IR.ready) {
      return 'IR serial port not available';
    } else if (ircode === undefined) {
      return 'ircode was undefined';
    } else if (ircode === null) {
      return 'ircode was null';
    } else if (!Array.isArray(ircode)) {
      return 'ircode must be an array';
    } else {
      // 0xA1, 0xF1 are the sync bytes
      IR.write([0xA1, 0xF1].concat(ircode));
      return null;
    }
  };

  let _getEntries = (names) => {
    let entries = [];
    for (let name of names) {
      for (let entry of this.NamedColors) {
        if (entry.name === name) {
          entries.push(entry);
          break;
        }
      }
    }
    return entries;
  }

  // public starts with this.
  
  this.NamedColors = [
      { hex: 'ff0000',  name: 'red' },
      { hex: 'ffa500',  name: 'orange' },
      { hex: 'ffff00',  name: 'yellow' },
      { hex: '00ff00',  name: 'green' },
      { hex: '00bfff',  name: 'light-blue' },
      { hex: '0000ff',  name: 'blue' },
      { hex: '6600cc',  name: 'blue-violet' },
      { hex: '8a2be2',  name: 'purple' },
      { hex: 'ffffff',  name: 'white' }
  ];

  this.ClientData = {
    lastColor: undefined,
    NamedColors: this.NamedColors
  };

  this.IRCodes = {
    Colors:{
      'ffffff': [0x00, 0xFF, 0x44],
      '00ff00': [0x00, 0xFF, 0x59],
      '0000ff': [0x00, 0xFF, 0x45],
      '6600cc': [0x00, 0xFF, 0x1E],
      '00bfff': [0x00, 0xFF, 0x1B],
      '8a2be2': [0x00, 0xFF, 0x1A],
      'ff0000': [0x00, 0xFF, 0x58],
      'ffff00': [0x00, 0xFF, 0x18],
      'ffa500': [0x00, 0xFF, 0x54]
    },
    Commands:{
      'power': [0x00, 0xFF, 0x40],
      'brighter': [0x00, 0xFF, 0x5C],
      'dimmer': [0x00, 0xFF, 0x5D]
    }
  };

  this.IRSequences = new function() {
    let _DEFAULT_INTERVAL = 200;

    this.bright = (callback) => {
      // turn it all the way up
      let i = 0;
      let timer = setInterval(() => {
        if (i < 8) {
          _send(_ROOT.IRCodes.Commands['brighter']);
          i++;
        } else {
          clearInterval(timer);
          if (callback !== undefined) {
            callback();
          }
        }
      },_DEFAULT_INTERVAL);
    };

    this.dim = (callback) => {
      let i = 0;
      let timer = setInterval(() => {
        if (i < 8) {
          _send(_ROOT.IRCodes.Commands['dimmer']);
          i++;
        } else {
          clearInterval(timer);
          if (callback !== undefined) {
            callback();
          }
        }
      },_DEFAULT_INTERVAL);
    };

    this.brightness = (level, callback) => {
      // all the way down
      this.dim(() => {
        // and back up to the desired level
        let i = 1;
        let timer = setInterval(() => {
          if (i < level) {
            _send(_ROOT.IRCodes.Commands['brighter']);
            i++;
          } else {
            clearInterval(timer);
            if (callback !== undefined) {
              callback();
            }
          }
        },_DEFAULT_INTERVAL);
      });

    };
  }

  this.sendCommand = (command) => {
    // try to lookup the command
    if (this.IRCodes.Commands[command] === undefined) {
      if (this.IRSequences[command] === undefined) {
        return 'command not found';
      } else {
        // send an IRSequence
        this.IRSequences[command]();
        return null;
      }
    } else {
      // send an IRCode command
      return _send(this.IRCodes.Commands[command]);
    }
  };

  this.sendHexColor = (hex) => {
    _send(this.IRCodes.Colors[hex]);
  };

  this.getColorSet = (setName) => {
    switch (setName) {
      case 'halloween':
        return _getEntries(['orange', 'purple']);
      case 'rainbow':
        return _getEntries(['red', 'orange', 'yellow','green', 'blue', 'blue-violet', 'purple']);
      case 'all':
        return Lights.NamedColors;
      default:
        // give all the 
        return [];
    }
  };

  //
  // SATELLITE FUNCTIONS
  //

  this.CycleTimer = new function() {

    // private starts with _
    const _FADE_THRESHOLD_TIME = 1000;
    const _FADE_STEPS = 5;
    let _colors = _ROOT.NamedColors;
    let _colorTimer = undefined;
    let _colorIndex = 0;
    let _fadeIndex = 0;
    let _fadeCommand = 'brighter';
    let _fadeTimer = undefined;
    let _interval = 1000;

    let _getIndex = () => {
      _colorIndex = (_colorIndex+1)%_colors.length
      return _colorIndex;
    };

    let _getFadeCommand = () => {
      _fadeIndex = (_fadeIndex+1)%_FADE_STEPS;
      if (_fadeIndex == 0) {
        switch(_fadeCommand) {
          case 'brighter': 
            _fadeCommand = 'dimmer';
            break;
          case 'dimmer':
            _fadeCommand = 'brighter';
        }
      }
      return _fadeCommand;
    };

    this.setInterval = (interval) => {
      _interval = interval;
      if (_colorTimer !== undefined) {
        if (_interval >= _FADE_THRESHOLD_TIME) {
          _ROOT.IRSequences.dim(() => {
            this.start(_colors);
          });
        } else {
          this.start(_colors);
        }
      }
    };

    // public starts with this.
    this.start = (colors) => {
      this.stop();
      _colors = colors;

      // set the fade timer, if above the threshold
      if (_interval >= _FADE_THRESHOLD_TIME ) {
        _fadeTimer = setInterval(() => {

          _ROOT.sendCommand(_getFadeCommand());

        }, _interval/_FADE_STEPS);
      }

      // set the color timer
      _colorTimer = setInterval(() => {

        const hex = _colors[_getIndex()].hex;
        _ROOT.sendHexColor(hex)
        
      }, _interval);

    };

    this.stop = () => {
      clearInterval(_colorTimer);
      _colorTimer = undefined;
      clearInterval(_fadeTimer);
      _fadeTimer = undefined;
      _fadeIndex = 0;
    };

  };
};

