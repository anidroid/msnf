window.nav = function(b, t) {
    if (design.blocks[b].each == true) {
        if (orderid < order.length) {
            currorder=orderid
            orderid=orderid+1
            routie('b/' + b + '/' + order[currorder].trialid + '/' + order[currorder].stimid)
          } else if (b + 1 >= design.blocks.length) {
              routie('end')
          } else {
            nextb = b + 1;
            routie('instr/' + nextb)
        }
    } else if (design.blocks[b].randomized == true) {
            if (orderid < order.length) {
                console.log(orderid)
                routie('b/' + b + '/' + order[orderid].trialid + '/' + order[orderid].stimid)
                orderid++
            } else {
                nextb = b + 1;
                routie('instr/' + nextb)
            }
    } else if (t + 1 < design.blocks[b].trials.length) {
        // IF MORE TRIALS, MOVE TO NEXT TRIAL
        nextt = t + 1
        routie('b/' + b + '/' + nextt + '/0')
    } else if (b + 1 >= design.blocks.length) {
        routie('end')
    } else if (t + 1 >= design.blocks[b].trials.length) {
        // IF ALL TRIALS AND REPEATS, MOVE TO NEXT BLOCK
        nextb = b + 1
        routie('instr/' + nextb)
    } else {
        console.log('err')
    }
}


history.pushState(null, null, document.URL);
window.addEventListener('popstate', function() {
    history.pushState(null, null, document.URL);
});
window.onbeforeunload = function() {
        return "By reloading the page you will exit the study and lose all of your data.";
    }

    // KINTO
    // https://github.com/Kinto/kinto-http.js
    //to setup a restricted collection (cmd)
    //  $ http POST https://janmatthis.de/v1/buckets --auth="ani:icecream" --verbose < cmd.json
    //    cmd.json = {"data": {"id": "app"}}
    //  $ http POST https://janmatthis.de/v1/buckets/app/collections --auth="ani:icecream" --verbose < cmd1.json
    //    cmd.json = {"data": {"id": "study2"}, "permissions": {"record:create": ["system.Authenticated"]}}

    // The variable QueryString contains the url parameters
    // via http://stackoverflow.com/a/979995
    window.QueryString = function() {
        var query_string = {};
        var query = window.location.search.substring(1);
        var vars = query.split("&");
        for (var i = 0; i < vars.length; i++) {
            var pair = vars[i].split("=");
            // If first entry with this name
            if (typeof query_string[pair[0]] === "undefined") {
                query_string[pair[0]] = pair[1];
                // If second entry with this name
            } else if (typeof query_string[pair[0]] === "string") {
                var arr = [query_string[pair[0]], pair[1]];
                query_string[pair[0]] = arr;
                // If third or later entry with this name
            } else {
                query_string[pair[0]].push(pair[1]);
            }
        }
        return query_string;
    }();

    // Function for encoding and decoding URLs
    // via http://meyerweb.com/eric/tools/dencoder/
    window.encode = function(unencoded) {
        return encodeURIComponent(unencoded).replace(/'/g, "%27").replace(/"/g, "%22");
    }
    window.decode = function(encoded) {
        return decodeURIComponent(encoded.replace(/\+/g, " "));
    }

    // Function to check whether an object contains
    Array.prototype.contains = function(obj) {
        var i = this.length;
        while (i--) {
            if (this[i] == obj) {
                return true;
            }
        }
        return false;
    }

    // http://stackoverflow.com/questions/1349404/generate-random-string-characters-in-javascript
    window.makeid = function() {
        var text = "";
        var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

        for (var i = 0; i < 8; i++)
            text += possible.charAt(Math.floor(Math.random() * possible.length));

        return text;
    }
