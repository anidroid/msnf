$(document).ready(function() {
    $.material.init()
    $('.undercover').hide();

    // read design yml from url or set automatically
    if (QueryString['d']) {
        var designsrc = window.decode(window.QueryString.d)
    } else {
        designsrc = 'study1.yml'
    };

    // read condition from url or set automatically
    if (QueryString['c']) {
      var c = window.decode(window.QueryString.c)
    } else {
      c = _.sample(["0","1","2","3"])
    };

    // checking if test run
    window.test = QueryString['test']

    // everything happens within this function
    function callbackStimuli(data) {

        design = YAML.parse(data);

        // setting up kinto
        var remote_adr = design.settings.server.remote_adr;
        var bucket_name = 'app';
        var collection_name = design.settings.server.collection;
        if (test=="true"){
          collection_name = design.settings.server.collectiontest;
        }
        var pn = _.random(1, 999999).toString();
        var pn_token = makeid(); // generate random string
        var db = new KintoClient(remote_adr, {
            bucket: bucket_name,
            headers: {
                Authorization: "Basic " + btoa(pn + ":" + pn_token)
            }
        });
        var kdat = db.bucket(bucket_name).collection(collection_name);

        // creating empty data objects
        dat = []
        pdat = {}

        // entering the following variables to participant data
        if (QueryString['id']) {
          pdat['pnid'] = QueryString['id'] //anonymous participant id, linking across data files
        } else {
          pdat['pnid'] = pn //anonymous participant id, linking across data files
        }
        pdat['pnsrc'] = undefined //source of data collection: e.g., prolific
        pdat['pnsrc'] = QueryString['s'] //source of data collection: e.g., prolific
        pdat['cond'] = c // condition

        // ...
        storytypes = ["LF","LT","CF","CT","NF","NT"]
        for(i in storytypes){
            sample = _.sample(_.where(design.stim.stories, {type: storytypes[i]}),5)
            for (s in sample){
              _.each(_.where(design.stim.stories, {'id': sample[s].id}), function(o) {o.veracity='noinfo'})
            }
        }

        // pairing each story with random source and date
        for (i in design.stim.stories) {
          design.stim.stories[i].source = _.sample(design.stim.sources)
          design.stim.stories[i].date = _.sample(design.stim.dates)
          _.each(_.where(design.stim.stories, {'veracity': true}), function(o) {o.checkdisp='likely true'})
          _.each(_.where(design.stim.stories, {'veracity': false}), function(o) {o.checkdisp='likely false'})
        }



        // determine what changes in each condition
        switch(c){
            case "0":
              // no fact checking
              design.layout = "#cond0-template"
            break;
            case "1":
              // no fact checking
              design.layout = "#cond1-template"
            break;
            case "2":
              // no fact checking
              design.layout = "#cond2-template"
            break;
            case "3":
              // no fact checking
              design.layout = "#cond3-template"
            break;
            default:
              console.log('err')
        }

        routie('init', function() {
            routie('instr/0')
            pdat['start'] = Date.now()
        });

        routie('instr/?:b', function(b) {
            b = parseInt(b)

            // set random trial order for all stimuli
            order = _.shuffle(_.range(design.stim.stories.length))

            // if in test mode, set fewer trials
            if(test=="true") {
              order = _.shuffle(_.range(5))
            }

            // clear block data object
            bdat = []

            $('.undercover').hide();
            $('#instr').show();
            $('#ctext').empty().append($.parseHTML(design.blocks[b].instr));
            $('.btn-instr').off('click').on('click', function() {
                $('#instr').hide();
                routie('run/'+b+'/0')
            });

        });

        routie('run/?:b/?:t', function(b,t) {

          $('.undercover').hide();
          b = parseInt(b)
          t = parseInt(t)
          curr = order[t]
          tdat = {}

          $('.progress-bar').css({'width':t/order.length*100+'%'});

          if(t==Math.round(order.length/2)){
            $('#halfway-dialog').show();

          }

          tdat['fcheck'] = 'NA';
          tdat['fcseen'] = 'NA';
          tstart =  Date.now()
          switch(c){
            case "0":
            break;
            case "1":
              tdat['fcheck'] = false;
              tdat['fcseen'] = false;
              $('#fcfb').empty();
              if (design.stim.stories[curr].veracity != "noinfo"){
                hb = Handlebars.compile($('#fc1-template').html());
                $('#fcfb').html(hb(design.stim.stories[curr]));
              } else {
                hb = Handlebars.compile($('#fc1-na-template').html());
                $('#fcfb').html(hb(design.stim.stories[curr]));
              }
            break;
            case "2":
              if (design.stim.stories[curr].veracity != "noinfo"){
                $('#fc').show();
                hb = Handlebars.compile($('#fc2-template').html());
                $('#fc').html(hb(design.stim.stories[curr]));
              } else {
                $('#fc').show();
                hb = Handlebars.compile($('#fc2-na-template').html());
                $('#fc').html(hb(design.stim.stories[curr]));
              }
            break;
            case "3":
            break;
            default:
              console.log('err')
          }

          $('#stim').show();
          hb = Handlebars.compile($(design.layout).html());
          $('#stim').html(hb({'hbprofiles': [design.stim.stories[curr]]}));

          $('.btn-check').on('click', function(){
            $('#fc-dialog').show();
            $("#loader").show();
            $('#fcfb').hide();
            tdat['fcheck'] = true;
            setTimeout(function()  {
                $("#loader").hide( );
                $('#fcfb').show();
                tdat['fcseen'] = true;
              }, _.sample(_.range(10,3000)));
          });

          $('.btn-dismiss').on('click', function(){
            $('#fc-dialog').hide();
            $('#halfway-dialog').hide();
          });


          $('.btn-modresp').off('click').on('click', function() {

              tdat['order'] = t;
              tdat['stimid'] = design.stim.stories[curr].id;
              tdat['src'] = design.stim.stories[curr].source;
              tdat['resp'] = $(this).data('resp');
              tdat['rt'] =  Date.now()-tstart
              bdat.push(tdat)
              tdat={}
              dat[design.blocks[b].id] = bdat
              if(t < order.length-1) {
                routie('run/'+b+'/'+(t+1))
              } else {
                if(b < design.blocks.length-1){
                  routie('instr/'+(b+1))
                } else {
                  routie('end')
                }
              }
          });
        });

        routie('end', function() {
            $('.progress').hide();
            $('.undercover').hide();
            $('#debrief').show();
            $('#dtext1').empty().append($.parseHTML(design.instr.debriefing.text1));
            pdat['end'] = Date.now();
            pdat['duration'] = pdat['end'] - pdat['start'];
            dat.person = [pdat]
            datsave = {
                data: JSON.stringify({headlines:dat.headlines,sources:dat.sources,person:dat.person}),
            }
            kdat.createRecord(datsave).then(function(res) {
                console.log('saved data on server')
            })
            $('.btn-end').off('click').on('click', function() {
                window.location.replace(design.settings.endredirect+pdat.pnid+'&s='+pdat.pnsrc)
            });
        });

        routie('debrief', function() {
            $('.progress').hide();

            $('.undercover').hide();

            $('#stim').show();
            hb = Handlebars.compile($('#debrief-template').html());
            $('#stim').html(hb({'hbprofiles': design.stim.stories}));

        });

}

$.get(designsrc, callbackStimuli)

});
