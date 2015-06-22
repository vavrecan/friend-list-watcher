/**
 * Friend List Watcher
 * This is Facebook API that is not using GRAPH API.
 * It goes around Facebook obstructions and parses data from html and json responses.
 *
 * @author Marek Vavrecan, vavrecan@gmail.com
 * @copyright 2013 Marek Vavrecan
 * @license http://www.gnu.org/licenses/gpl-3.0.html GNU General Public License, version 3
 * @version 1.0.0
 */

function FacebookAPI()
{
    this.info = null;

    this.initializeRequests = function() {
        // make sure custom referrer request will work
        chrome.webRequest.onBeforeSendHeaders.addListener(
            function(details) {
                for (var i = 0; i < details.requestHeaders.length; ++i) {
                    if (details.requestHeaders[i].name.toLowerCase() === 'x-referer') {
                        details.requestHeaders.push({name:"Referer",value: details.requestHeaders[i].value });
                    }
                    if (details.requestHeaders[i].name.toLowerCase() === 'x-origin') {
                        details.requestHeaders.push({name:"Origin",value: details.requestHeaders[i].value });
                    }
                }

                return {requestHeaders: details.requestHeaders};
            },
            {urls: ["*://m.facebook.com/*"]},
            ["requestHeaders", "blocking"]
        );
    };
    this.initializeRequests();

    /**
     * Serialize data for the post request
     * @param obj
     * @param prefix
     * @returns {string}
     */
    this.serializeUrlParams = function(obj, prefix) {
        var str = [];
        for(var p in obj) {
            if (obj.hasOwnProperty(p)) {
                var k = prefix ? prefix + "[" + p + "]" : p, v = obj[p];
                str.push(typeof v == "object" ? this.serializeUrlParams(v, k) : encodeURIComponent(k) + "=" + encodeURIComponent(v));
            }
        }
        return str.join("&");
    };

    /**
     * Make request
     * @param options
     * @param callback
     */
    this.request = function(options, callback) {
        if (typeof(options.method) == "undefined")
            options.method = "GET";

        if (typeof(options.response) == "undefined")
            options.response = "document";

        var xhr = new XMLHttpRequest();
        xhr.onload = function() {
            var document = '';

            if (options.response == "document") {
                document = this.responseXML;
            }

            if (options.response == "json") {
                document = this.responseText;
                // strip this useless loop from facebook response
                if (document.substring(0, "for (;;);".length) == "for (;;);")
                    document = document.substring("for (;;);".length);
                document = JSON.parse(document);
            }

            callback(document);
        };

        xhr.open(options.method, options.url);
        xhr.responseType = options.response == "json" ? "text" : options.response;

        if (options.referer) {
            xhr.setRequestHeader("x-referer", options.referer);
        }

        if (options.origin) {
            xhr.setRequestHeader("x-origin", options.origin);
        }

        if (options.method == "POST") {
            xhr.setRequestHeader("Content-type","application/x-www-form-urlencoded");
            var data = this.serializeUrlParams(options.params, false);
            xhr.send(data);
        }
        else {
            xhr.send();
        }
    };

    /**
     * Find string inside of page scripts text
     * @param document
     * @param regex
     * @param group
     * @returns {*}
     */
    this.matchScriptContents = function(document, regex, group) {
        if (!group)
            group = 1;

        var scripts = document.querySelectorAll("script");
        for (var i = 0; i < scripts.length; i++) {
            var contents = scripts[i].innerText;

            // find ID in javascript
            var match = regex.exec(contents);

            if (match)
                return match[group];
        }

        return null;
    };

    /**
     * Get common info
     * @param callback
     */
    this.getInfo = function(callback) {
        var self = this;
        if (self.info) {
            callback(self.info);
            return;
        }

        this.request({"url": "https://m.facebook.com/me"}, function(document) {
            var info = {};

            info.id = self.matchScriptContents(document, /"USER_ID":"(\d+)"/g, 1);
            info.name = document.querySelector("title").innerText;
            info.username = self.matchScriptContents(document, /"page_uri":"https(.*?)facebook\.com\\\/(.*?)\?/g, 2);

            // user is not logged in if info is 0
            if (info.id == "0") {
                callback(false);
            }
            else {
                self.info = info;
                callback(info);
            }
        });
    };

    /**
     * Get list of notes
     * @param callback
     */
    this.getNotes = function(callback) {
        var self = this;
        this.getInfo(function(info) {
            if (!info) {
                callback(false);
                return;
            }

            self.request({"url": "https://m.facebook.com/notes?id=" +  info.id}, function(document) {

                var notes = [];
                var items = document.querySelectorAll("#root .item");

                for (var i = 0; i < items.length; i++) {
                    var item = items[i];
                    var title = item.querySelector(".title").innerText.trim();
                    var href = item.querySelector("a.primary").getAttribute("href");
                    var id = null;
                    var regex = /\/(\d+)\/$/g;

                    var match = regex.exec(href);
                    if (match)
                        id = match[1];

                    notes.push({"id": id, "title": title, "href" : href});
                }

                callback(notes);
            });
        });
    };

    this.getNote = function(noteId, callback) {
        var self = this;
        this.getInfo(function(info) {
            if (!info) {
                callback(false);
                return;
            }

            var url = "https://m.facebook.com/note/edit/dialog/?note_id=" + noteId + "&m_sess=&__dyn=&__req=8&__ajax__=true&__user=" +  info.id;
            self.request({"url": url, "response": "json"}, function(data) {
                var doc = document.implementation.createHTMLDocument("");
                doc.querySelector("body").innerHTML = data.payload.actions[0].html;

                var note = {};
                note.id = noteId;
                note.title = doc.querySelector("input[name='title']").getAttribute("value");
                note.body = doc.querySelector("textarea[name='body']").innerText;
                note.privacy = doc.querySelector("select[name='privacy'] > option[selected='1']").getAttribute("value");

                note._internal = {};
                note._internal.action = doc.querySelector("form[method='post']").getAttribute("action");
                note._internal.fb_dtsg = doc.querySelector("input[name='fb_dtsg']").getAttribute("value");
                note._internal.charset_test = doc.querySelector("input[name='charset_test']").getAttribute("value");

                callback(note);
            });
        });
    };

    this.updateNote = function(noteId, params, callback) {
        var self = this;
        this.getInfo(function(info) {
            if (!info) {
                callback(false);
                return;
            }

            self.getNote(noteId, function(note) {
                var url = "https://m.facebook.com" + note._internal.action;
                var postParams = {
                    "fb_dtsg": note._internal.fb_dtsg,
                    "charset_test": note._internal.charset_test,
                    "title": note.title,
                    "body": params.body,
                    "privacy": note.privacy
                };

                self.request({
                    "url": url,
                    "response": "document",
                    "method": "POST",
                    "params": postParams,
                    "referer": "https://m.facebook.com/editnote.php",
                    "origin": "https://m.facebook.com"}, function(data) {
                    // TODO add verification
                    console.log(data);
                    callback(true);
                });
            });
        });
    };

    this.createNote = function(params, callback) {
        var self = this;
        this.getInfo(function(info) {
            if (!info) {
                callback(false);
                return;
            }

            var url = "https://m.facebook.com/editnote.php";
            self.request({"url": url, "response": "document"}, function(doc) {
                var internal = {};
                internal.action = doc.querySelector("form[method='post']").getAttribute("action");
                internal.fb_dtsg = doc.querySelector("input[name='fb_dtsg']").getAttribute("value");
                internal.charset_test = doc.querySelector("input[name='charset_test']").getAttribute("value");
                internal.privacy = doc.querySelector("select[name='privacy'] option[value*='\"value\":10']").getAttribute("value"); // privacy me only

                var url = "https://m.facebook.com" + internal.action;
                var postParams = {
                    "fb_dtsg": internal.fb_dtsg,
                    "charset_test": internal.charset_test,
                    "title": params.title,
                    "body": params.body,
                    "privacy": internal.privacy
                };

                self.request({"url": url, "response": "document",
                    "method": "POST", "params": postParams,
                    "referer": "https://m.facebook.com/editnote.php",
                    "origin": "https://m.facebook.com"}, function(data) {
                    console.log(data);
                    callback(true);
                });
            });
        });
    };

    this.findNoteByTitle = function(title, callback) {
        var self = this;
        this.getNotes(function(notes) {
            for (var i = 0; i < notes.length; i++)
            {
                if (notes[i].title == title) {
                    callback(notes[i]);
                    return;
                }
            }
            callback(null);
        });
    };

    /**
     * TODO it would be better to read friend list from page, but is much more difficult
     * @param info
     * @param startIndex
     * @param merge
     * @param callback
     */
    this.getFriendsFragment = function(info, startIndex, merge, callback) {
        var self = this;

        this.request({"url": "https://facebook.com/" + info.username + "?sk=friends&list=1"}, function (document) {
            // https://www.facebook.com/ajax/pagelet/generic.php/AllFriendsAppCollectionPagelet?data=%7B%22collection_token%22%3A%22.....%3A......
            // %3A2%22%2C%22cursor%22%3A%22CURSOR IS SOMEWHERE IN THE SOURCE MAN%22%2C%22tab_key%22%3A%22friends%22%2C%22profile_id%22%3A.....
            // %2C%22q%22%3A%22.......%22%2C%22overview%22%3Afalse%2C%22ftid%22%3Anull%2C%22order%22%3Anull%2C%22sk%22%3A%22friends%22%2C%22importer_state%22%3Anull%7D&__user=...&__a=0
        });
    };

    /**
     * Get chunk of the friend list
     * @param info
     * @param startIndex
     * @param merge
     * @param callback
     */
    this.getFriendsFragmentMobile = function(info, startIndex, merge, callback) {
        var self = this;
        this.request({"url": "https://m.facebook.com/" + info.username + "?v=friends&mutual&startindex=" + startIndex}, function(document) {
            var friends = [];
            var main = document.querySelector(".timeline");

            // skip to first block if there is ajax form
            if (main.querySelector(":scope > form"))
                main = main.querySelector(":scope > div");

            for (var i = 0; i < main.children.length; i++) {
                var children = main.children[i];

                // exclude controls not containing children
                if (children.querySelector(".item") || children.querySelector("header") || children.querySelector(".seeMoreFriends"))
                    continue;

                // walk through all user rows
                var profiles = children.childNodes;
                for (var j = 0; j < profiles.length; j++) {
                    var profile = profiles[j];

                    var href = profile.querySelector("h3 a");
                    var title = profile.querySelector("h3");
                    var dataStore = profile.querySelector("a[data-store^='{']");

                    if (href && title) {
                        var store = JSON.parse(dataStore.getAttribute("data-store"));
                        friends.push({
                            "name": title.innerText,
                            "href": href.getAttribute("href").substring("/".length),
                            "id": store.id
                        });
                    }
                }
            }

            var nextStartIndex = self.matchScriptContents(document, /"id":"m_more_friends"(.*?)startindex=(\d+)/g, 2);

            if (merge) {
                if (nextStartIndex) {
                    self.getFriendsFragmentMobile(info, nextStartIndex, true, function(moreFriends) {
                        callback(friends.concat(moreFriends));
                    });
                }
                else {
                    callback(friends);
                }

                return;
            }

            callback({"friend":friends, "nextStartIndex": nextStartIndex});
        });
    };

    /**
     * Get friend list
     * @param callback
     */
    this.getFriends = function(callback) {
        var self = this;
        this.getInfo(function(info) {
            if (!info) {
                callback(false);
                return;
            }

            self.getFriendsFragmentMobile(info, 0, true, function(data) {
                callback(data);
            });
        });
    };
}
