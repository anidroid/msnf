$(document).ready(function() {

    $('.undercover').hide();

    // read design yml from url or set automatically
    if (QueryString['d']) {
        var designsrc = window.decode(window.QueryString.d)
    } else {
        designsrc = 'design.yml'
    };

    // read condition from url or set automatically
    if (QueryString['c']) {
      var c = window.decode(window.QueryString.c)
    } else {
      c = _.sample(["0","1","2"])
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
        var pn = _.sample(_.range(1, 9999), 1).toString();
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
        pdat['pnid'] = QueryString['id'] //anonymous participant id, linking across data files
        pdat['pnsrc'] = QueryString['s'] //source of data collection: e.g., prolific
        pdat['cond'] = c // condition

        // pairing each story with random source and date
        for (i = 0; i < design.stim.stories.length; i++) {
          design.stim.stories[i].source = _.sample(design.stim.sources)
          design.stim.stories[i].date = _.sample(design.stim.dates)
        }

        // determine which block to display, based on condition
        switch(c){
            case "0":
              window.stimuli = _.first(design.stim.stories,54)
              design.blocks = [design.blocks[0]]
            break;
            case "1":
              window.stimuli = _.last(design.stim.stories,54)
              design.blocks = [design.blocks[0]]
            break;
            case "2":
              window.stimuli = design.stim.sources
              design.blocks = [design.blocks[1]]
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
            order = _.shuffle(_.range(stimuli.length))

            // if in test mode, set fewer trials
            if(test=="true") {
              order = _.shuffle(_.range(2))
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
          $('#stim').show();
          hb = Handlebars.compile($('#'+design.blocks[b].stimlayout+"-template").html());
          $('#stim').html(hb({'hbprofiles': [stimuli[curr]]}));

          $('#qq').show();
          hb = Handlebars.compile($("#qtpre-template").html());
          $("#qq").html(hb({'qs': design.blocks[b].qs}));
          $('#qtpre-text').html(design.blocks[b].qinstr);

          $('.btn-resp').off('click').on('click', function() {
            for (i = 0; i < $('.form-control').length; i++) {
              // require response
              if($('.form-control')[i].value === "Please select..."){
                window.reqresp = alertify.error("Please respond to question "+(i+1));
                var proceed = false;
              } else {
                // save trial responses to trial data
                lab = $('.form-control')[i].id
                res = $('.form-control')[i].value
                switch(c){
                    case "0":
                        tdat['order'] = t;
                        tdat['stimid'] = stimuli[curr].id;
                        tdat['src'] = stimuli[curr].source;
                        tdat['resp_'+lab] = res;
                    break;
                    case "1":
                        tdat['order'] = t;
                        tdat['stimid'] = stimuli[curr].id;
                        tdat['src'] = stimuli[curr].source;
                        tdat['resp_'+lab] = res;
                    break;
                    case "2":
                        tdat['order'] = t;
                        tdat['src'] = stimuli[curr];
                        tdat['resp_'+lab] = res;
                    break;
                    default:
                    console.log('err')
                }
                //push trial data to block data
              }
            }
            if(proceed!=false){
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
            }
          });
        });

        routie('end', function() {

            $('.undercover').hide();
            $('#debrief').show();
            $('#dtext1').empty().append($.parseHTML(design.instr.debriefing.text1));
            pdat['end'] = Date.now();
            pdat['duration'] = pdat['end'] - pdat['start'];
            dat.person = [pdat]
            console.log('hi')
            datsave = {
                data: JSON.stringify({headlines:dat.headlines,sources:dat.sources,person:dat.person}),
            }
            kdat.createRecord(datsave).then(function(res) {
                console.log('saved data on server')
            })
            $('.btn-end').off('click').on('click', function() {
                window.location.replace(design.settings.endredirect+pdat.QID+'&s='+pdat.SRC)
            });
        });

        routie('debrief', function() {

            $('.undercover').hide();

            $('#stim').show();
            hb = Handlebars.compile($('#debrief-template').html());
            $('#stim').html(hb({'hbprofiles': design.stim.stories}));

        });

}

$.get(designsrc, callbackStimuli)

});
