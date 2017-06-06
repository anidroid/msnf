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
              var remote_adr = design.server.remote_adr;
              var bucket_name = 'app';
              var collection_name = design.server.collection;
              var pn = _.sample(_.range(1, 9999), 1).toString();
              var pn_token = makeid(); // generate random string
              var db = new KintoClient(remote_adr, {
                  bucket: bucket_name,
                  headers: {
                      Authorization: "Basic " + btoa(pn + ":" + pn_token)
                  }
              });
              var kdat = db.bucket(bucket_name).collection(collection_name);

              datP = {}

              // gen stim
              for (i = 0; i < design.stories.length; i++) {
                design.stories[i].source = _.sample(design.sources)
                design.stories[i].date = _.sample(design.dates)
              }

              // add partials
              Handlebars.registerPartial("stimcomplete", $("#stimcomplete-partial").html());

              var templateQT1 = Handlebars.compile($("#qt1-template").html());
              var templateQT2 = Handlebars.compile($("#qt2-template").html());
              var templateQT3 = Handlebars.compile($("#qt3-template").html());
              var templateQT6 = Handlebars.compile($("#qt6-template").html());

              routie('init', function(bl) {
                  $('.undercover').hide();
                  $('#instr').show();
                  $('#ctext').empty().append($.parseHTML(design.consent));
                  $('.btn-instr').off('click').on('click', function() {
                      $('#instr').hide();
                      routie('instr/0')
                  });
                  page=-1;
                  datP['START'] = Date.now()
              });

              routie('instr/?:bl', function(bl) {

                  window.blockStart = Date.now()
                  $('.undercover').hide();
                  b = parseInt(bl)
                  t = -1
                  $('#instr').show();
                  if (b == 0 && design.pretest == false){
                    $('#ctext').empty().append($.parseHTML(design.blocks[b].instr));
                  } else {
                    $('#ctext').empty().append($.parseHTML(design.blocks[b].instr));
                  }
                  $('.btn-instr').off('click').on('click', function() {
                      $('#instr').hide();
                      nav(b, t)
                  });

                  order = []; orderid = 0
                  if (design.blocks[b].each == true) {
                    order = []; orderid = 0
                      for (var i = 0; i < design.stories.length; i++) {
                          for (var tr = 0; tr < design.blocks[b].trials.length; tr++) {
                              order.push({ trialid: tr, stimid: i })
                          }
                      }

                    if (design.blocks[b].randomized == true) {
                        order = _.shuffle(order);
                      }
                  } else if (design.blocks[b].randomized == true) {
                      order = []; orderid = 0
                        for (var tr = 0; tr < design.blocks[b].trials.length; tr++) {
                            order.push({ trialid: tr, stimid: 0 })
                        }
                      order = _.shuffle(order);
                  }

              });

              routie('b/?:block/?:trial/?:stim', function(block, trial, stim) {

                b = parseInt(block);
                t = parseInt(trial)
                s = parseInt(stim)

                $('.undercover').hide();

                curr = design.blocks[b].trials[t]
                layout = '#' + curr.layout
                var hb = Handlebars.compile($(layout + '-template').html());
                switch(design.blocks[b].type){

                  case 'stim':

                      page++

                      $(layout).show();

                      datt = [];
                      for (i = s; i < s + design.blocks[b].stimT; i++) {
                          datt.push(design.stories[i])
                      }

                      $(layout).html(hb({
                          'hbprofiles': datt
                      }));
                      $('.modresp').show();


                      $('.btn-check').off('click').on('click', function(e) {
                          e.preventDefault();
                            $("#loader-wrapper").show( );
                          setTimeout(
                            function()
                            {
                              $("#loader").hide( );
                              $("#fc-false").show( );
                            }, 5000);
                      });

                      //nav(1,t,r)
                      $('.btn-stim').off('click').on('click', function() {
                          datP["L_DURATION"] = (Date.now() - blockStart) / 1000;
                          nav(b)
                      });
                  break;

                  case 'pretest':
                  page++

                  $(layout).show();

                  datt = [];
                  for (i = s; i < s + design.blocks[b].stimT; i++) {
                      datt.push(design.stories[i])
                  }

                  $(layout).html(hb({
                      'hbprofiles': datt
                  }));
                  $('.qt1-choices').show();

                  //nav(1,t,r)
                  $('.btn-stim').off('click').on('click', function() {
                      datP["L_DURATION"] = (Date.now() - blockStart) / 1000;
                      nav(b)
                  });

                }

              });

              routie('end', function() {
                  $('.undercover').hide();
                  $('#debrief').show();
                  $('#dtext1').empty().append($.parseHTML(design.debriefing.text1));
                  $('#dtext1').append(design.debriefing.platform[0].code);
                  $('#dtext2').empty().append($.parseHTML(design.debriefing.text2));
                  $('#dtext2').append(datP["PN"]);
                  $('#dtext2').append($.parseHTML(design.debriefing.text3));
                  datP['END'] = Date.now();
                  datP['DURATION'] = datP['END'] - datP['START'];
                  datsave = {
                      datp: JSON.stringify([datP]),
                      datt: JSON.stringify(datT)
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
