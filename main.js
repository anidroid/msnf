$(document).ready(function() {

  if(QueryString['v']){
    script = QueryString['v']+'.js'
    $.getScript( script, function() {
    });
  } else {
    $.getScript( 'pretest.js', function() {
    });
  }

});
