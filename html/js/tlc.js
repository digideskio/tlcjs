console.log("TLC is starting up...");

/* OUTPUT AND INFRASTRUCTURE */

// NOTE(dbp 2016-02-15): These two functions are for tests _within_
// tlc.js. We should probably replace these with mocha or something
// better, as we don't need to have them be super simple.
function test(desc, expected, given) {
  function err(r) {
    console.error("TEST FAILED: " + desc + ". Got " + r + ", but expected " + expected);
  }
  try {
    var res = given();
    if (!(_.isEqual(expected, res))) {
      err(res);
    }
  } catch (e) {
    err("exception");
  }
}

function testRaises(desc, given) {
  try {
    console.error("TEST FAILED: " + desc + ". Expected exception, but got value: " + given());
  } catch (e) {}
}

// NOTE(dbp 2016-02-15): On the other hand, _this_ function is for use
// by TLC.js students.
var testResults = { run: 0, passed: 0, failures: [] };

function updateTestDiv(results, container) {
  container.textContent = "Tests: " + String(results.passed) + "/" + String(results.run) + " passed.";
  if (results.failures.length !== 0) {
    container.textContent += "\n\nFailures:\n";
  }
  results.failures.forEach(function (f) {
    container.textContent += "  " + f + "\n";
  });
}


function updateTestUi() {
  var output = document.getElementById("tlc-test-results");

  if (output === null) {
    var output = document.createElement("pre");
    output.id = "tlc-test-results";
    _addOutput(output);
  }

  updateTestDiv(testResults, output);
}

function _shouldEqualInternal(includeStack, results, redraw, given, expected) {
  results.run++;
  if (_.isEqual(given, expected)) {
    results.passed++;
  } else {
    // NOTE(dbp 2016-02-15): This is a hack to find out where the
    // assertion was called from. Eeek!
    console.log((new Error()).stack.split("\n"));
    var s = (new Error()).stack.split("\n")[2];
    var loc = s.slice(s.lastIndexOf("/")+1, s.length - 2);
    if (includeStack) {
      var msg = loc + " - expected " + JSON.stringify(expected) + ", but got " + JSON.stringify(given) + ".";
    } else {
      var msg = String(results.run) + ": expected " + JSON.stringify(expected) + ", but got " + JSON.stringify(given) + ".";
    }
    results.failures.push(msg);
  }
  redraw();
}

function shouldEqual(given, expected) {
  return _shouldEqualInternal(true, testResults, updateTestUi, given, expected);
}


/* These constants are provided for convenience, so that you don't
 * accidentally write "nmber" in a call to _type. If you write TNmber,
 * you'll get an error, whereas if you write the wrong string, it
 * won't be until the _use_ of the resulting function that bizarre
 * things will happen. */
var tNumber = "number";
var tString = "string";
var tObject = "object";
var tArray = "array";
var tBoolean = "boolean";
var tFunction = "function";
var tAny = "anything";
var tNothing = "undefined";

var tArrow = function(args, ret) {
  return { tag: "arrow", args: args, ret: ret };
};

/* This checks a value against a type, or in the case of a function,
 * wraps the function so that when it is used, the proper check
 * occurs. The type can be a flat type, like `tNumber`, or it can be
 * an arrow type, like `tArrow([tNumber], tNumber)`. The latter allows
 * us to ensure that arguments passed to, for example, `animate`, are
 * indeed functions of the right type.
 */
function __type(ty, err, val) {
  // NOTE(dbp 2016-02-13): String types are flat checks.
  if (typeof ty === "string") {
    if (ty === tAny) {
      if (typeof val === "undefined") {
        throw new TypeError(err);
      } else {
        return val;
      }
    } else if (ty === tArray) {
        if (_.isArray(val)) {
            return val;
        } else {
            throw new TypeError(err);
        }
    } else if (typeof val !== ty) {
      console.log("Value " + val + " has wrong type. Expected " + ty + " but got " + typeof val);
      throw new TypeError(err);
    } else {
      return val;
    }
  } else {
    if (ty.tag === "arrow") {
      if (val.length !== ty.args.length) {
        throw new TypeError(err);
      }
      return function () {
        // First, check arity.
        if (arguments.length !== ty.args.length) {
          throw new TypeError(err);
        }

        // Next, check/wrap arguments.
        var args = _.map(_.zip(arguments, ty.args), function(x) {
          var arg_ty = x[1];
          var arg = x[0];
          return __type(arg_ty, err, arg);
        });

        // Finally, call function and check return value.
        var res = val.apply(this, args);
        return __type(ty.ret, err, res);
      };
    }
  }
}

test("__type numbers", 10, function () { return __type(tNumber, "", 10); });
test("__type strings", "foo", function () { return __type(tString, "", "foo"); });
testRaises("__type numbers", function () { return __type(tNumber, "", "hello"); });
testRaises("__type tAny doesn't match undefined", function () { return __type(tAny, "", undefined); });
test("__type arrays", [1], function() { return __type(tArray, "", [1]); });
testRaises("__type arrays don't match objects", function () { return __type(tArray, "", {}); });
testRaises("__type objects don't match arrays", {}, function () { return __type(tObject, "", []); });
testRaises("__type higher order arity", function () {
  return __type(tArrow([tNumber], tAny), "", function () {})();
});
testRaises("__type higher order arg type", function () {
  return __type(tArrow([tNumber], tAny), "", function (x) {})("foo");
});
testRaises("__type higher order return type", function () {
  return __type(tArrow([], tNumber), "", function () { return "foo";})();
});
testRaises("__type higher order return catches no return", function () {
  return __type(tArrow([], tObject), "", function () { {};})();
});

/* This function helps make errors better by asserting that the
 * arguments to the function `f` have the number and type specified by
 * `arg_types`. If they don't, the message `err` is raised. */
function _type(arg_types, ret, err, f) {
  return __type(tArrow(arg_types, ret), err, f);
}

testRaises("_type function argument, return type", function () {
  return _type([tArrow([tNumber], tObject)], tNothing, "ERR", function f(g) {
    g(10);
  })(function (n) { /* returns noting */ });
});

var body = document.getElementById("tlc-body");
if (body === null) {
  console.log("TLC: not creating output, no body.");
} else {
  var output = document.createElement("div");
  output.id = "output";

  var source = document.createElement("div");
  source.id = "source";

  body.appendChild(source);
  body.appendChild(output);

  var style = document.createElement("style");

  style.textContent = "#output { width: 45%; float: left; } #source { width: 45%; float: left; } .output { border-bottom: 1px solid #ccc; padding: 10px 0; } #images { width: 45%; float: right; } ";

  body.appendChild(style);

  output.style.margin = "10px";
  output.style.padding = "10px";
  output.style.background = "#eee";
  output.style.border = "1px solid #ccc";
}

function _addOutput(content) {
  var output = document.getElementById("output");
  if (output !== null) {
    var container = document.createElement("div");
    container.className = "output";
    container.appendChild(content);
    output.appendChild(container);
    return container;
  }
}

var show_source_usage = "show_source(): Requires one arguments, a url, which should be a string. For example: show_source('some-file.js')";
var show_source = _type([tString], tNothing, show_source_usage, function (url) {
  var source = document.getElementById("source");
  if (source !== null) {
    var client = new XMLHttpRequest();
    client.open('GET', url);
    var pre = document.createElement("pre");
    source.appendChild(pre);
    client.onreadystatechange = function() {
      pre.textContent = client.responseText;
    }
    client.send();
  }
});


/* LIBRARY FOR DRAWING ETC */

/* print :: anything -> nothing */
var print_usage = "print(): Requires one argument, which can be anything. For example: print(10).";
var print = _type([tAny], tNothing, print_usage, function(value) {

  if (typeof value === "object" && value.hasOwnProperty("tlc_dt")) {
    draw(value);
  } else {
    var pre = document.createElement("pre");
    pre.textContent = String(value);

    _addOutput(pre);
  }
});

/* circle :: number -> color -> shape */
var circle_usage = "circle(): Requires two arguments, a radius and a color, which should be a number and a string. For example: circle(100, 'red').";
var circle = _type([tNumber, tString], tObject, circle_usage, function(radius, color) {

  var circ = { tlc_dt: "circle",
               radius: radius,
               color: color,
               x: 0,
               y: 0 };

  return { tlc_dt: "image",
           elements: [circ],
           width: radius * 2,
           height: radius * 2 };
});

/* rectangle :: number -> number -> color -> shape */
var rectangle_usage = "rectangle(): Requires three arguments, a width, a height, and a color. The first two should be numbers, the last a string. For example: rectangle(100, 50, 'black').";
var rectangle = _type([tNumber, tNumber, tString], tObject, rectangle_usage, function(width, height, color) {

  var rect = { tlc_dt: "rectangle",
               width: width,
               height: height,
               color: color,
               x: 0,
               y: 0 };

  return { tlc_dt: "image",
           elements: [rect],
           width: width,
           height: height };
});

var line_usage = "line(): Requires four arguments, all numbers --  StartX, StartY, EndX, EndY. Line draws a line from one point to another. The first two arguments are the X,Y coordinates of the starting point. The last two arguments are the X,Y coordinates of the ending point. For example: line(0,0, 100, 200)";
var line = _type([tNumber,tNumber,tNumber,tNumber], tObject, line_usage, function(startX, startY, endX, endY) {

  var line = { tlc_dt: "line",
               startX: startX,
               startY: startY,
               endX: endX,
               endY: endY,
               x:0,
               y:0
             };

  return { tlc_dt: "image",
           elements: [line],
           width: endX,
           height: endY
         };

});


var text_usage = "text(): Requires two arguments, text to place in the graphic and a number, the size of the text in pixele. Example: text('Hello', 20).";
// input: string (text to print), number (size of font in pixels); output: image
var text = _type([tString, tNumber], tObject, text_usage, function(wordsOrNumbers, fontSize){

  // create a temp context in order to measure text
  var ctx = document.createElement("canvas").getContext("2d");
  ctx.font = '' + fontSize + "px serif";

  if (typeof wordsOrNumbers == "string") {
      var string = wordsOrNumbers;
  } else if (typeof wordsOrNumbers == "number") {
      var string = wordsOrNumbers.toString();
  } else {
      throw "text(): Requires a string or number as the first argument.";
  };

  var txt = { tlc_dt: "text",
              text: string,
              fontSize: fontSize,
              x: 0,
              y: 0
            };

  return { tlc_dt: "image",
           elements: [txt],
           width: ctx.measureText(string).width,
           height: fontSize
         };
});

/* image :: url -> shape */
var image_usage = "image(): Requires one argument, a url, which should be a string. For example, image('cat.jpg').";
var image = _type([tString], tObject, image_usage, function(location) {
  var img = new Image()
  //img.src = location;
  //img.style.visibility = "hidden"

  // append the node, get the dimensions, and remove it again
  //document.body.appendChild(img);
  //var imgClone = img.cloneNode();
  //document.body.removeChild(img);

  var imgShape = { tlc_dt: "image",
                   img: img,
                   locaton: location
                 };

  img.onload = function() {
    imgShape.width = img.width;
    imgShape.height = img.height;
  };

  img.src = location;

  return [imgShape];
});

function _drawInternal(cont, image, givenCanvas) {

  if (givenCanvas) {
    var canvas = givenCanvas;
  } else {
    var canvas = document.createElement("canvas");
  }

  var ctx = canvas.getContext("2d");

  if (image) {
    canvas.width = image.width;
    canvas.height = image.height;
  }


  if (typeof image === "undefined" || !image.hasOwnProperty("elements")) {
    ctx.clearRect(0,0,canvas.width,canvas.height);
  } else {

    for (var i = 0; i < image.elements.length; i++) {
      var shape = image.elements[i];
      switch (shape.tlc_dt) {
      case "rectangle":
        ctx.fillStyle = shape.color;
        ctx.fillRect(shape.x,
                     shape.y,
                     shape.width,
                     shape.height);
        break;
      case "circle":
        ctx.beginPath();
        ctx.fillStyle = shape.color;
        ctx.arc(shape.x + shape.radius,
                shape.y + shape.radius,
                shape.radius, 0, 2 * Math.PI);
        ctx.fill();
        break;
      case "image":
        shape.img.onload = function() {
          ctx.drawImage(shape.img,
                        shape.x,
                        shape.y);
        };
        break;
      case "text":
        ctx.fillStyle = "black";
        ctx.font = '' +  shape.fontSize + "px serif";
        ctx.fillText(shape.text, shape.x, fontSizeHelper(shape.y, shape.fontSize));
        break;
      case "line":
        ctx.beginPath();
        ctx.moveTo(shape.startX,shape.startY);
        ctx.lineTo(shape.endX,shape.endY);
        ctx.stroke();
        break;
      default:
        break;
      }
    }
  }

  if (!givenCanvas) {
    cont(canvas);
  }
}


/* draw :: image -> nothing */
var draw_usage = "draw(): Requires one argument, a image. For example, draw(circle(10, 'red')).";
var draw = _type([tObject], tNothing, draw_usage, function(image) {
  return _drawInternal(_addOutput, image);
});

// text/fontsize helper function
// ensures the y value for fill text is, at minimum, equal to the fontsize.
// input: number (shape.y), number (shape.fontSize)
// output: number
function fontSizeHelper(y, fontSize) {
  if (y >= fontSize) {
    return y;
  } else {
    return fontSize;
  }
}

/* emptyScene :: number -> number -> image */
var emptyScene_usage = "emptyScene(): Requires two arguments, a width and a height, both numbers. For example: emptyScene(300, 200).";
var emptyScene = _type([tNumber, tNumber], tObject, emptyScene_usage, function(width, height) {
  return overlay(rectangle(width-2, height-2, "white"),
                 rectangle(width, height, "black"));
});

/* overlay :: image -> image -> image */
var overlay_usage = "overlay(): Requires two arguments, a foreground and a background image. For example, overlay(circle(10, 'red'), emptyScene(100, 100)).";
var overlay = _type([tObject, tObject], tObject, overlay_usage, function(foreground, background) {
  var newX = background.width/2
             - foreground.width/2;
  var newY = background.height/2
             - foreground.height/2;

  return placeImage(foreground, background, newX, newY);
});

/* placeImage :: image -> image -> x -> y -> image  */
var placeImage_usage = "placeImage(): Requires four arguments: a forgeground image, a background image, and the x and y coordinates for the top left of the foreground to be placed on the background (both numbers). For example, placeImage(rectangle(10,10,'red'), rectangle(100,100,'black'), 40, 40).";
var placeImage = _type([tObject, tObject, tNumber, tNumber], tObject, placeImage_usage, function(foreground, background, x, y) {
  var centeredElements =
      _.map(foreground.elements, function(e) {
        var newE = _.clone(e);
        newE.x = e.x + x;
        newE.y = e.y + y;
        return newE;
      });

  var image = _.clone(background);

  image.elements =
    image.elements.concat(centeredElements);

  return image;
});

function _animateInternal(withCanvas, tickToImage) {

  var canvas = document.createElement("canvas");
  withCanvas(canvas);

  var ticks = 0;
  function step() {
    _drawInternal(withCanvas, tickToImage(ticks), canvas);
    ticks = ticks + 1;
    window.requestAnimationFrame(step);
  }

  step();
}

/* animate :: (tick -> image) -> nothing */
var animate_usage = "animate(): Requires one argument, a function that takes a number and produces a image. For example: animate(function(n) { return overlay(circle(n, 'red'), emptyScene(100,100));}).";
var animate = _type([tArrow([tNumber], tObject)], tNothing, animate_usage, function(tickToImage) {
  return _animateInternal(_addOutput, tickToImage);
});

function _bigBangInternal(withCanvas, world, to_draw, on_tick, on_key) {

    var canvas = document.createElement("canvas");
    withCanvas(canvas);

    _drawInternal(withCanvas, to_draw(world), canvas);

    var keysPressed = [];

    window.addEventListener("keydown", function(event) {
      keysPressed.push(event.code);
    }, true)

    var newWorld = world;
    function step() {
      _drawInternal(withCanvas, to_draw(newWorld), canvas);
      newWorld = _.reduce(keysPressed, function (currentWorld, key) {
          return on_key(currentWorld, key);
      }, newWorld);
      keysPressed = [];
      newWorld = on_tick(newWorld);
      window.requestAnimationFrame(step);
    }

    step();
}

/* big_bang :: world -> (world -> image) ->
                        (world -> world) ->
                        (world -> string -> world) -> nothing */
var bigBang_usage = "bigBang(): Requires four arguments. The first argument is the initial state of the world. The second argument is a function that takes one argument, a world, and returns an image. The third argument is a function that takes one argument, a world, and returns another world. The last argument takes a world and string. For example: bigBang(0, function(n) { return text(n.toString(), 16);}, function(n) { return n + 1; }, function(n, key) { return n - 10; }).";
var bigBang = _type([tAny,
                     tArrow([tAny], tAny),
                     tArrow([tAny], tAny),
                     tArrow([tAny, tString], tAny)], tNothing, bigBang_usage, function(world, to_draw, on_tick, on_key) {

    return _bigBangInternal(_addOutput, world, to_draw, on_tick, on_key);

});

var scale_usage = "scale(): Requires two arguments, an image and a percentage. For example: scale(circle(20, 'red'), 50)."
var scale = _type([tObject, tNumber], tObject, scale_usage, function(image, percentage) {
    return  _.assign({}, image, {
        width: image.width * percentage / 100,
        height: image.height * percentage / 100,
        elements: image.elements.map(function(element){
            return scale_element(element, percentage);
        })
    });
});

var scale_element = function (shape, percentage) {
    return ({
        circle: _.assign({}, shape, {
            radius: shape.radius * percentage / 100,
            x: shape.x * percentage / 100,
            y: shape.y * percentage / 100
        }),
        rectangle: _.assign({}, shape, {
            width: shape.width * percentage / 100,
            height: shape.height * percentage / 100,
            x: shape.x * percentage / 100,
            y: shape.y * percentage / 100
        }),
        text: _.assign({}, shape, {
            fontSize: shape.fontSize * percentage / 100,
            x: shape.x * percentage / 100,
            y: shape.y * percentage / 100
        })
    })[shape.tlc_dt];
};

var width_usage = "width(): Requires one argument, an image. For example: width(circle(20, 'red')).";
var width = _type([tObject], tNumber, width_usage, function(image) {
  return image.width;
});

var bike = circle(30, "red");

var height_usage = "height(): Requires one argument, an image. For example: height(circle(20, 'red')).";
var height = _type([tObject], tNumber, height_usage, function(image) {
  return image.height;
});

var stringLength_usage = "stringLength(): Requires one argument, a string. For example: length('Hello world')."
var stringLength = _type([tString], tNumber, stringLength_usage, function(string) {
  return string.length;
});

/* Array functions */

var prefix_usage = "prefix(): Requires two arguments, an item to add to the beginning an array, and an array. For example: prefix(1, [2,3,4,5])."
var prefix = _type([tAny, tArray], tArray, prefix_usage, function(item, array) {
    var newArray = _.cloneDeep(array);
    newArray.unshift(item);
    return newArray;
});
test ("prefix add to empty", [1], function () { return prefix(1, []); });
test ("prefix add to existing", [1,2], function () { return prefix (1, [2]); });

var isEmpty_usage = "isEmpty(): Requires one argument, an array. For example: isEmpty([])."
var isEmpty = _type([tArray], tBoolean, isEmpty_usage, function(array) {
    return array.length === 0;
});
test("isEmpty empty list", true, function () { return isEmpty([]); });
test("isEmpty non-empty", false, function () { return isEmpty([1]); });

var head_usage = "head(): Requires one argument, an array. For example: head([1,2,3])."
var head = _type([tArray], tAny, head_usage, function(array) {
    return _.head(array);
});
testRaises("don't call head on empty arrays", function () { return head([]); });
test("head non-empty", 1, function () { return head([1]); });
test("head non-empty longer", 1, function () { return head([1,2,3]); });

var tail_usage = "tail(): Requires one argument, an array. For example: tail([1,2,3])."
var tail = _type([tArray], tAny, tail_usage, function(array) {
    return _.tail(array);
});
// tail of an empty list is an empty list??
test("tail empty", [], function () { return tail([]); });
test("tail non-empty", [], function () { return tail([1]); });
test("tail non-empty longer", [2,3], function () { return tail([1,2,3]); });

/* Incorporating into EJS sandbox */
function sandbox_draw(win, image) {
  _drawInternal(function (canvas) {
      var div = document.createElement("div");
      div.appendChild(canvas);
      win.output.div.appendChild(div);
  }, image);
}
function tlc_sandbox_functions(win) {
  return {
    print: _type([tAny], tNothing, print_usage, function(value) {
      if (typeof value === "object" && value.hasOwnProperty("tlc_dt")) {
        sandbox_draw(win, value);
      } else {
        win.out("log", arguments);
      }
    }),
    bike: circle(30, "red"),
    prefix: prefix,
    head: head,
    tail: tail,
    emptyList: [],
    circle: circle,
    rectangle: rectangle,
    text: text,
    overlay: overlay,
    line: line,
    width: width,
    height: height,
    stringLength: stringLength,
    scale: scale,
    placeImage: placeImage,
    emptyScene: emptyScene,
    animate: _type([tArrow([tNumber], tObject)], tNothing, animate_usage, function(tick) {
      _animateInternal(function (canvas) {
        var div = document.createElement("div");
        div.appendChild(canvas);
        win.output.div.appendChild(div);
      }, tick);
    }),
    bigBang: _type([tAny,
                     tArrow([tAny], tAny),
                     tArrow([tAny], tAny),
                     tArrow([tAny, tString], tAny)], tNothing, bigBang_usage, function(world, to_draw, on_tick, on_key) {
                       _bigBangInternal(function (canvas) {
                         var div = document.createElement("div");
                         div.appendChild(canvas);
                         win.output.div.appendChild(div);
                       }, world, to_draw, on_tick, on_key);
    }),
    draw: _type([tObject], tNothing, draw_usage, function(image) {
      sandbox_draw(win, image);
    }),
    shouldEqual: function(given, expected) {
      var output = win.output.testOutput;
      if (typeof output === "undefined" || !document.contains(output)) {
        output = document.createElement("pre");
        win.output.testOutput = output;
        win.output.div.appendChild(output);
        win.output.testResults = { passed: 0, run: 0, failures: []};
      }
      function redraw() {
        updateTestDiv(win.output.testResults, output);
      }
      return _shouldEqualInternal(false, win.output.testResults, redraw, given, expected);
    }
  };
}
