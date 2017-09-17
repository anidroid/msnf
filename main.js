$('.undercover').hide();
setTimeout(function()  {
  $('.cover').hide();
}, 500);

$(document).ready(function() {

    if(QueryString['v']){
      window.script = QueryString['v']
      $.getScript( script+'.js', function() {
      });
    }

    if(typeof QueryString['v'] === "undefined") {
      window.script = 'study2'
      $.getScript( script+'.js', function() {
      });
    }

});
