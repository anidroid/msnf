$(document).ready(function() {

  if(QueryString['v']){
    script = QueryString['v']+'.js'
    $.getScript( script, function() {
    });
  }

  if(typeof QueryString['v'] === "undefined") {
    $.getScript( 'pretest.js', function() {
    });
  }

});
