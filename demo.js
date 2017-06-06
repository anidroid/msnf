  $(document).ready(function() {

          $('.undercover').hide();

          if (QueryString['c']) {
              var cond = window.decode(window.QueryString.c)
          } else {
              cond = _.sample([1,2])
          };

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
              pdat.QID = QueryString['id']
              dat = []

              // gen stim
              for (i = 0; i < design.stim.stories.length; i++) {
                design.stim.stories[i].source = _.sample(design.stim.sources)
                design.stim.stories[i].date = _.sample(design.stim.dates)
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
                  order = _.shuffle(_.range(design.stim[design.blocks[b].stim].length))
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
                $('#stim').html(hb({'hbprofiles': [design.stim[design.blocks[b].stim][curr]]}));

                $('#qq').show();
                hb = Handlebars.compile($("#qtpre-template").html());
                $("#qq").html(hb({'qs': design.blocks[b].qs}));
                $('#qtpre-text').html(design.blocks[b].qinstr);

                $('.btn-resp').off('click').on('click', function() {
                  for (i = 0; i < $('.form-control').length; i++) {
                    if($('.form-control')[i].value === "Please select..."){
                      window.reqresp = alertify.error("Please respond to question "+i);
                      var proceed = false;
                    } else {
                      lab = $('.form-control')[i].id
                      res = $('.form-control')[i].value
                      switch(b){
                          case 0:
                              tdat['ORDER'] = t;
                              tdat['SID'] = design.stim.stories[curr].id;
                              tdat['SRC'] = design.stim.stories[curr].source;
                              tdat['Q_'+lab] = res;
                          break;
                          case 1:
                              tdat['ORDER'] = t;
                              tdat['SRC'] = design.stim.sources[curr];
                              tdat['Q_'+lab] = res;
                          break;
                          default:
                          console.log('err')
                      }
                      bdat[t] = tdat
                    }
                  }
                  if(proceed!=false){
                    if(t < order.length-1) {
                      routie('run/'+b+'/'+(t+1))
                    } else {
                      if(b < design.blocks.length-1){
                        dat[design.blocks[b].id] = bdat
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
                  pdat['END'] = Date.now();
                  pdat['DURATION'] = pdat['END'] - pdat['START'];
                  dat['PDAT'] = pdat
                  datsave = {
                      data: JSON.stringify([dat]),
                  }
                  kdat.createRecord(datsave).then(function(res) {
                      console.log('saved data on server')
                  })
                  $('.btn-end').off('click').on('click', function() {
                      window.location.replace(design.endredirect)
                  });
              });

      }

      $.get(designsrc, callbackStimuli)

  });
