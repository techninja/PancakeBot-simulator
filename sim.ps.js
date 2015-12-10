var path;

var mainLayer = project.getActiveLayer();
var previewLayer = new Layer();


var speed = 120; // Speed of bot in mms per second
var batter = {
  width: 2,
  cWidth: 0,
  rate: 0.10,
  delay: {
    start: 0.75,
    end: 0.85
  },
  last: 0,
  frequency: 0.01,
  variation: {
    amt: 0.5,
    last: 0,
    strength: 0.3,
    frequency: 0.7
  }
};
var batterPaths = []; // Storage for the final lines


function onMouseDown() {
  previewLayer.opacity = previewLayer.opacity === 0 ? 1 : 0;
}

var pancakeColor = '#f2e3bf'; // This is darkened with .lightness <= 0.4

//* Test Points!
window.points = [
  new Point(view.bounds.width/2, 50),
  {t: "on"},
  {t: "pause", s: 4}, // Warm up wait
  new Point(view.bounds.width/2 + 50, 50),
  new Point(view.bounds.width/2, 100),
  {t: "off"}, // Pre end pump off
  new Point(view.bounds.width/2, 120),
  new Point(view.bounds.width/2, 50),
]
//*/

window.points = [];

var cPoint = 0;

mainLayer.activate();
var extruder = new Path.Circle({
  center: [view.bounds.width, view.bounds.height/2],
  radius: 10,
  strokeColor: 'red',
  strokeWidth: 3
});

var moveVector;

var x = batter.width / 2;
var pauseTime = 0;
var onTime = -1;
var offTime = -1;
var isPaused = false;
var blob;
var lastVector;
var darkenFactor = 0.2 / 30 / 30; // Change in lightness over 30 seconds
var darkenBatter = false;
function onFrame(event) {
  if (typeof points[cPoint] !== 'undefined') {

    // Command point
    if (points[cPoint].t) {
      switch (points[cPoint].t) {
        case "off":
          // Pump may be off, but batters flows till end delay
          offTime = event.time + batter.delay.end;
          console.log('Pump OFF');
          break;
        case "on":
          // Create a new batter path
          path = new Path({
            fillColor: pancakeColor,
            closed: true
          });

          // Offset start time to include delay. Pump may be on, but batter
          // hasn't hit the griddle yet.
          onTime = event.time + batter.delay.start;
          batter.cWidth = 0;
          offTime = -1; // Cancel any given offtime (in case we overlapped)
          console.log('Pump ON');
          break;
        case "pause":
          pauseTime = event.time + points[cPoint].s;
          console.log('Pause for', points[cPoint].s);
          break;
        case "color":
          darkenBatter = true; // Allows paused moments to darken the batter
          // Resets on next normal unpaused time
          break;
      }
      cPoint++;
      moveVector = null;
      return; // Don't do any other render this frame
    }

    // Create a new moveVector (for each new point)
    if (!moveVector) {
      moveVector = points[cPoint] - extruder.position;
      // Speed (incremental vector length) based on distance
      var divisor = (moveVector.length / speed) * 60;
      moveVector = moveVector / divisor;
      moveVector.maxLength = moveVector.length * divisor;
      moveVector.totalLength = 0;
    }

    if (pauseTime < event.time) {
      // Move the extruder
      extruder.position += moveVector;

      // Increment the vectors total length moved by its position increment length
      moveVector.totalLength += moveVector.length;
      console.log('move');
      isPaused = false;
      darkenBatter = false;
    } else {
      isPaused = true;
      console.log('waiting');

      // Darken all the batter currently on the griddle
      if (darkenBatter) {
        //console.dir(batterPaths);
        _.each(batterPaths, function(p) {
          p.fillColor.lightness-= darkenFactor;
        });
      }
    }

    if (path) {
      // We're warming up
      // If the pump is on but we're not moving, keep making the width bigger
      if (onTime > event.time || isPaused) {
        batter.cWidth+= batter.rate;
      } else if (offTime === -1) {
        batter.cWidth = batter.width;
      }

      /* Bubble Method
      if (batter.last < event.time) {
        if (batter.cWidth) {
          var blob = new Path.Circle({center: extruder.position, radius: batter.cWidth});
          var newBlob = path.unite(blob);
          blob.remove(); path.remove();
          path = newBlob;
          path.sendToBack();
          path.smooth();
        }

        batter.last = event.time + batter.frequency;
      }
      //*/

      //* Dual grow path method
      var rot = moveVector.rotate(90) * x;

      // Recalculate X every once in a while
      if (batter.variation.last < event.time) {
        x = (batter.cWidth/2) + (batter.variation.strength * (Math.random() * batter.variation.amt));
        batter.variation.last = event.time + (batter.variation.frequency * (Math.random() * batter.variation.amt));
      }

      // Time for more points?
      if (batter.last < event.time) {

        if (!isPaused) {
          x = (batter.cWidth/2) + (batter.variation.strength * (Math.random() * batter.variation.amt));

          // Actually add new segments
          path.add(extruder.position + rot);
          path.insert(0, extruder.position - rot);
          path.sendToBack();

          // Break persistant link to blob (so a new one can be made)
          if (blob) {
            batterPaths.push(blob);
            blob = null;
          }
        } else { // Only if paused, make the circles!
          // Remove the old blob, if it's there.
          if (blob) blob.remove();

          blob = new Path.Circle({
            center: extruder.position,
            radius: batter.cWidth,
            fillColor: pancakeColor,
          });
          blob.sendToBack();
        }

        batter.last = event.time + batter.frequency;
      } else if(path.firstSegment) {
        // Drag the end segments along with the position, but don't create any
        // extra segments
        if (!isPaused) {
          path.segments[path.segments.length-1].point = extruder.position + rot;
          path.segments[0].point = extruder.position - rot;
        }
      }

      path.smooth();
      //*/

      if (offTime !== -1) {
        batter.cWidth = Math.max(0, batter.cWidth - batter.rate);
         if (offTime < event.time) {
          // Actually kill the batter path (after saving a ref to it)
          batterPaths.push(path);
          path = null;
          offTime = -1;
        }
      }
    }

    // We've Arrived! Clear everything out to be new for the next point
    if (moveVector.totalLength >= moveVector.maxLength) {
      cPoint++;
      lastVector = moveVector + 0;
      moveVector = null;
    }

  }
}

$('#simstart').click(function(){

  //console.log(previewPaths);

  // Remove old batterPaths & previews if any
  _.each(batterPaths, function(p) {
    if (p) {
      if (p.remove) p.remove();
    }
  });

  // Remove old batterPaths & previews if any
  _.each(previewPaths, function(p) {
    if (p) {
      if (p.remove) p.remove();
    }
  });

  points = [];
  extruder.position = new Point(view.bounds.width/2, 0);

  if (path) {
    path.remove();
    path = null;
  }

  if (blob) {
    blob.remove();
    blob = null;
  }

  // Preview paths go on this layer
  previewLayer.activate();
  parseCodeSet($('textarea').val());

  // Everything else goes here.
  mainLayer.activate();
});

// UTIL FUNCTIONS ==============================================================
// =============================================================================
window.parseCodeSet = parseCodeSet;
function parseCodeSet(codeSet) {
  codeSet = codeSet.split("\n");
  _.each(codeSet, function(line) {
    parseCode(line);
  });
}


// Print area limitations (in MM)
// From technical documents (default, alternates loaded in via W1 GCODE)
var printArea = {x: 42, y: 210, l: 485, t: 0};

// Convert an input PancakeBot coordinate to an output Paper.JS mapped coordinate
function reMap(p) {
  var b = view.bounds;
  return new Point({
    x: map(p.x, printArea.l, printArea.x, b.x, b.width),
    y: map(p.y, printArea.t, printArea.y, b.y, b.height)
  });
}

// Map a value in a given range to a new range
function map(x, inMin, inMax, outMin, outMax) {
  return (x - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
}

var lastP;
var preview = {};
var previewPaths = [];

function parseCode(codeLine) {
  // Split by comments to remove them, trimmed, upercased then split by space
  codeLine = $.trim(codeLine.split(';')[0]).toUpperCase().split(' ');

  // Shift off the first element as the code, the rest are arguments
  var code = codeLine.shift()

  // Parse arguments into an object
  var args = {};
  _.each(codeLine, function(arg) {
    args[arg[0].toLowerCase()] = parseFloat(arg.substr(1));
  });

  switch (code) {
    case 'M106': // Pump ON
      preview = new Path({
        strokeWidth: 1,
        strokeColor: 'green'
      });
      if (lastP) preview.add(lastP)
      points.push({t: "on"});
      break;
    case 'M107': // Pump OFF
      previewPaths.push(preview);
      preview = null;
      points.push({t: "off"});
      break;
    case 'G4': // Pause/Motors Off
      if (args.p) points.push({t: "pause", s: args.p/1000});
      break;
    case 'M142': // Bottle change/color change timer
      points.push({t: "color"});
      break;
    case 'G00': // X Y Move
      // Only draw move point if pump is on and there's a point passed to G1
      if (args.x) {
        var p = reMap(args);
        lastP = reMap(args);
        if (preview) preview.add(p);
        points.push(p);
      }

      break;
    case 'W1': // Workspace Setup
      printArea = args;
      console.log(args);
      break;
    case 'G28': // Park to 0,0
      points.push(new Point(view.bounds.width, 0));
      break;
    default: // We can ignore these: G21, G90, etc
  }
}
