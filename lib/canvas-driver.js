'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

exports.translateVtreeToInstructions = translateVtreeToInstructions;
exports.renderInstructionsToCanvas = renderInstructionsToCanvas;
exports.c = c;
exports.rect = rect;
exports.arc = arc;
exports.text = text;
exports.line = line;
exports.polygon = polygon;
exports.image = image;
exports.makeCanvasDriver = makeCanvasDriver;
exports.canvasDriver = canvasDriver;

var _adapt = require('@cycle/run/lib/adapt');

var _xstream = require('xstream');

var _xstream2 = _interopRequireDefault(_xstream);

var _fromEvent = require('xstream/extra/fromEvent');

var _fromEvent2 = _interopRequireDefault(_fromEvent);

var _windowOrGlobal = require('window-or-global');

var _windowOrGlobal2 = _interopRequireDefault(_windowOrGlobal);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _toArray(arr) { return Array.isArray(arr) ? arr : Array.from(arr); }

function flatten(array) {
  if (typeof array.reduce !== 'function') {
    return array;
  }

  return array.reduce(function (flatArray, arrayElement) {
    return flatArray.concat(flatten(arrayElement));
  }, []);
}

function compact(array) {
  return array.filter(function (element) {
    return element !== undefined && element !== null;
  });
}

function translateRect(element, origin) {
  return element.draw.map(function (operation) {
    var operations = [{ set: 'lineWidth', value: operation.lineWidth || 1 }];

    if (operation.clear) {
      operations.push({
        call: 'clearRect',
        args: [origin.x, origin.y, element.width, element.height]
      });
    }

    if (operation.fill) {
      operations.push({
        set: 'fillStyle',
        value: operation.fill || 'black'
      });

      operations.push({
        call: 'fillRect',
        args: [origin.x, origin.y, element.width, element.height]
      });
    }

    if (operation.stroke) {
      operations.push({
        set: 'strokeStyle',
        value: operation.stroke || 'black'
      });

      operations.push({
        call: 'strokeRect',
        args: [origin.x, origin.y, element.width, element.height]
      });
    }

    return operations;
  });
}

function translateLine(element, origin) {
  var operations = [{ set: 'lineWidth', value: element.style.lineWidth || 1 }, { set: 'lineCap', value: element.style.lineCap || 'butt' }, { set: 'lineJoin', value: element.style.lineJoin || 'mitter' }, { set: 'strokeStyle', value: element.style.strokeStyle || 'black' }];

  if (element.style.lineDash && element.style.lineDash.constructor === Array) {
    operations.push({
      call: 'setLineDash',
      args: element.style.lineDash
    });
  }

  operations.push({
    call: 'moveTo',
    args: [origin.x, origin.y]
  });

  operations.push({
    call: 'beginPath',
    args: []
  });

  element.points.forEach(function (point) {
    operations.push({
      call: 'lineTo',
      args: [origin.x + point.x, origin.y + point.y]
    });
  });

  operations.push({
    call: 'stroke',
    args: []
  });

  operations.push({
    call: 'setLineDash',
    args: []
  });

  return operations;
}

function translatePolygon(element, origin) {
  var _element$points = _toArray(element.points),
      first = _element$points[0],
      rest = _element$points.slice(1);

  return [].concat([{ call: 'beginPath', args: [] }], [{ call: 'moveTo', args: [origin.x + first.x, origin.y + first.y] }], rest.map(function (point) {
    return { call: 'lineTo', args: [origin.x + point.x, origin.y + point.y] };
  }), [{ call: 'closePath', args: [] }], element.draw.map(function (operation) {
    var fillInstructions = [{ set: 'fillStyle', value: operation.fill }, { call: 'fill', args: [] }];
    var strokeInstructions = [{ set: 'strokeStyle', value: operation.stroke }, { call: 'stroke', args: [] }];
    return operation.fill ? fillInstructions : operation.stroke ? strokeInstructions : [];
  }));
}

function translateText(element, origin) {
  return element.draw.map(function (operation) {
    var operations = [{ set: 'textAlign', value: element.textAlign || 'left' }, { set: 'font', value: element.font }];

    var args = [element.value, origin.x, origin.y];

    if (element.width) {
      args.push(element.width);
    }

    if (operation.fill) {
      operations.push({
        set: 'fillStyle',
        value: operation.fill || 'black'
      });

      operations.push({
        call: 'fillText',
        args: args
      });
    }

    if (operation.stroke) {
      operations.push({
        set: 'strokeStyle',
        value: operation.stroke || 'black'
      });

      operations.push({
        call: 'strokeText',
        args: args
      });
    }

    return operations;
  });
}

function translateImage(element, origin) {
  var args = [element.image];

  if (element.sx != null) {
    args.push(element.sx, element.sy, element.sWidth, element.sHeight);
  }

  args.push(element.x, element.y);

  if (element.width != null) {
    args.push(element.width, element.height);
  }

  return [{ call: 'drawImage', args: args }];
}

function translateArc(element, origin) {
  var operations = [{ call: 'beginPath', args: [] }, { call: 'arc', args: [element.x, element.y, element.radius, element.startAngle, element.endAngle, element.anticlockwise || false] }];

  element.draw.map(function (operation) {
    if (operation.fill) {
      operations.push({
        set: 'fillStyle',
        value: operation.fill || 'black'
      });

      operations.push({
        call: 'fill',
        args: []
      });
    }

    if (operation.stroke) {
      operations.push({
        set: 'strokeStyle',
        value: operation.stroke || 'black'
      });

      operations.push({
        call: 'stroke',
        args: []
      });
    }
  });

  return operations;
}

function translateVtreeToInstructions(element, parentEl) {
  if (!element) {
    return;
  }

  if (!parentEl) {
    parentEl = { x: 0, y: 0 };
  }

  var origin = {
    x: element.x ? parentEl.x + element.x : parentEl.x,
    y: element.y ? parentEl.y + element.y : parentEl.y
  };

  var elementMapping = {
    rect: translateRect,
    line: translateLine,
    text: translateText,
    polygon: translatePolygon,
    image: translateImage,
    arc: translateArc
  };

  var instructions = preDrawHooks(element);

  instructions.push(elementMapping[element.kind](element, origin));

  instructions.push(postDrawHooks());

  var flatInstructions = compact(flatten(instructions));

  if (element.children) {
    element.children.forEach(function (child) {
      var childInstructions = translateVtreeToInstructions(child, element);

      if (childInstructions) {
        flatInstructions.push.apply(flatInstructions, _toConsumableArray(childInstructions));
      }
    });
  }

  return flatInstructions;
}

function renderInstructionsToCanvas(instructions, context) {
  instructions.forEach(function (instruction) {
    if (instruction.set) {
      context[instruction.set] = instruction.value;
    } else if (instruction.call) {
      context[instruction.call].apply(context, _toConsumableArray(instruction.args));
    }
  });
}

function preDrawHooks(element) {
  var operations = [{ call: 'save', args: [] }];

  if (element.transformations) {
    element.transformations.forEach(function (transformation) {
      if (transformation.translate) {
        operations.push({
          call: 'translate',
          args: [transformation.translate.x, transformation.translate.y]
        });
      }

      if (transformation.rotate) {
        operations.push({
          call: 'rotate',
          args: [transformation.rotate]
        });
      }

      if (transformation.scale) {
        operations.push({
          call: 'scale',
          args: [transformation.scale.x, transformation.scale.y]
        });
      }
    });
  }

  return operations;
}

function postDrawHooks() {
  return [{ call: 'restore', args: [] }];
}

function c(kind, opts, children) {
  if (opts.children) {
    children = opts.children;
  }

  return Object.assign({}, opts, { kind: kind, children: children });
}

function rect(opts, children) {
  return c('rect', opts, children);
}

function arc(opts, children) {
  return c('arc', opts, children);
}

function text(opts, children) {
  var defaults = {
    draw: [{ fill: 'black' }]
  };

  return c('text', _extends({}, defaults, opts), children);
}

function line(opts, children) {
  var defaults = {
    style: {
      lineWidth: 1,
      lineCap: 'butt',
      lineJoin: 'miter',
      strokeStyle: 'black'
    }
  };
  return c('line', _extends({}, defaults, opts), children);
}

function polygon(opts, children) {
  return c('polygon', opts, children);
}

function image(opts) {
  return c('image', opts, []);
}

function makeCanvasDriver(selector) {
  var canvasSize = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;

  var hostCanvas = _windowOrGlobal2.default.document.querySelector(selector);

  if (!hostCanvas) {
    hostCanvas = _windowOrGlobal2.default.document.createElement('canvas');

    _windowOrGlobal2.default.document.body.appendChild(canvas);
  }

  if (canvasSize) {
    hostCanvas.width = canvasSize.width;
    hostCanvas.height = canvasSize.height;
  }

  var context = hostCanvas.getContext('2d');

  var driver = function canvasDriver(sink$) {
    sink$.addListener({
      next: function next(rootElement) {
        var rootElementWithDefaults = getRootElementWithDefaults(hostCanvas, rootElement);

        var instructions = translateVtreeToInstructions(rootElementWithDefaults);

        renderInstructionsToCanvas(instructions, context);
      },
      error: function error(e) {
        throw e;
      },
      complete: function complete() {
        return null;
      }
    });

    return {
      events: function events(eventName) {
        return (0, _adapt.adapt)((0, _fromEvent2.default)(hostCanvas, eventName));
      }
    };
  };

  return driver;
}

function canvasDriver(sink$) {
  sink$.addListener({
    next: function next(_ref) {
      var hostCanvas = _ref.hostCanvas,
          rootElement = _ref.rootElement;

      var context = hostCanvas.getContext('2d');

      var rootElementWithDefaults = getRootElementWithDefaults(hostCanvas, rootElement);

      var instructions = translateVtreeToInstructions(rootElementWithDefaults);

      renderInstructionsToCanvas(instructions, context);
    },
    error: function error(e) {
      throw e;
    },
    complete: function complete() {
      return null;
    }
  });

  return (0, _adapt.adapt)(_xstream2.default.empty());
}

function getRootElementWithDefaults(hostCanvas, rootElement) {
  var defaults = {
    kind: 'rect',
    x: 0,
    y: 0,
    width: hostCanvas.width,
    height: hostCanvas.height,
    draw: [{ clear: true }]
  };

  return Object.assign({}, defaults, rootElement);
}