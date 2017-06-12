$(document).ready(function() {

  if(QueryString['v']){
    script = QueryString['v']+'.js'
    console.log(script)
    $.getScript( script, function() {
    });
  } else {
    $.getScript( 'pretest.js', function() {
    });
  }

});
