// modified from http://html5demos.com/file-api
var $gcode = $('html');

$gcode.on('dragover', function(e) {
  this.className = 'hover';
  e.preventDefault();
  e.stopPropagation();
  return false;
});

$gcode.on('dragend', function(e) {
  this.className = '';
  e.preventDefault();
  e.stopPropagation();
  return false;
});

$gcode.on('drop', function(e){
  this.className = '';
  e.preventDefault();
  e.stopPropagation();

  var file = e.originalEvent.dataTransfer.files[0];
  var reader = new FileReader();
  reader.readAsText(file);
  reader.onload = function(event) {
    $('#gcode').val(event.target.result);
    $('#simstart').click();
  };

  return false;
});
