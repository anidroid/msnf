  $(document).ready(function() {

          $('.undercover').hide();

          if (QueryString['c']) {
              var c = window.decode(window.QueryString.c)
          } else {
              c = _.sample(["0","1","2"])
          };
          console.log(c)

          if (QueryString['d']) {
              var designsrc = window.decode(window.QueryString.d)
          } else {
              designsrc = 'design.yml'
          };

          function callbackStimuli(data) {

              design = YAML.parse(data);

              // KINTO settings to yml?
              var remote_adr = design.settings.server.remote_adr;
              var bucket_name = 'app';
              var collection_name = design.settings.server.collection;
              var pn = _.sample(_.range(1, 9999), 1).toString();
              var pn_token = makeid(); // generate random string
              var db = new KintoClient(remote_adr, {
                  bucket: bucket_name,
                  headers: {
                      Authorization: "Basic " + btoa(pn + ":" + pn_token)
                  }
              });
              var kdat = db.bucket(bucket_name).collection(collection_name);

              pdat = {}
              dat = []

              pdat.QID = QueryString['id']
              pdat.SRC = QueryString['s']
              pdat.CND = c
              test = QueryString['test']

              // gen stim
              for (i = 0; i < design.stim.stories.length; i++) {
                design.stim.stories[i].source = _.sample(design.stim.sources)
                design.stim.stories[i].date = _.sample(design.stim.dates)
              }

              // Determine which block to display, based on condition
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

              // add partials
              Handlebars.registerPartial("stimcomplete", $("#stimcomplete-partial").html());

              var templateQT1 = Handlebars.compile($("#qt1-template").html());
              var templateQT2 = Handlebars.compile($("#qt2-template").html());
              var templateQT3 = Handlebars.compile($("#qt3-template").html());

              routie('init', function() {
                  routie('instr/0')
                  pdat['START'] = Date.now()
              });

              routie('instr/?:b', function(b) {
                  b = parseInt(b)
                  order = _.shuffle(_.range(stimuli.length))
                  if(test=="true") {
                    console.log('testtrue')
                    order = _.shuffle(_.range(2))
                  }
                  bdat = {}
                  $('.undercover').hide();
                  $('#instr').show();
                  $('#ctext').empty().append($.parseHTML(design.blocks[b].instr));
                  $('.btn-instr').off('click').on('click', function() {
                      $('#instr').hide();
                      routie('run/'+b+'/0')
                  });
                  pdat['START'] = Date.now()
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
                    if($('.form-control')[i].value === "Please select..."){
                      window.reqresp = alertify.error("Please respond to question "+(i+1));
                      var proceed = false;
                    } else {
                      lab = $('.form-control')[i].id
                      res = $('.form-control')[i].value
                      switch(c){
                          case 0:
                              tdat['ORDER'] = t;
                              tdat['SID'] = stimuli[curr].id;
                              tdat['SRC'] = stimuli[curr].source;
                              tdat['Q_'+lab] = res;
                          break;
                          case 1:
                              tdat['ORDER'] = t;
                              tdat['SID'] = stimuli[curr].id;
                              tdat['SRC'] = stimuli[curr].source;
                              tdat['Q_'+lab] = res;
                          break;
                          case 2:
                              tdat['ORDER'] = t;
                              tdat['SRC'] = stimuli[curr];
                              tdat['Q_'+lab] = res;
                          break;
                          default:
                          console.log('err')
                      }
                      bdat[t] = tdat
                      dat[design.blocks[b].id] = bdat
                    }
                  }
                  if(proceed!=false){
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
                  pdat['END'] = Date.now();
                  pdat['DURATION'] = pdat['END'] - pdat['START'];
                  datsave = {
                      data: JSON.stringify({headlines:dat.headlines,sources:dat.sources,person:pdat}),
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
