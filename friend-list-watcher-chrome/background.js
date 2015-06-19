/**
 * Friend List Watcher
 * @author Marek Vavrecan, vavrecan@gmail.com
 * @copyright 2013 Marek Vavrecan
 * @license http://www.gnu.org/licenses/gpl-3.0.html GNU General Public License, version 3
 * @version 1.0.0
 */

var facebookAPI = new FacebookAPI();
var processing = false;

function serialize(data) {
    return jsyaml.safeDump(data, {"flowLevel":1});
}

function unserialize(data) {
    return jsyaml.safeLoad(data);
}

function finishedUpdating() {
    processing = false;
    chrome.runtime.sendMessage({
        from:    'background',
        subject: 'processing',
        processing: false,
        text: ''
    });
}

function saveChanges(diff, callback) {
    facebookAPI.findNoteByTitle("Friend List Changes", function(note) {
        if (!note) {
            facebookAPI.createNote({"title": "Friend List Changes", "body": serialize(diff)}, callback);
        }
        else {
            facebookAPI.getNote(note.id, function(data) {
                var newDiff = diff.concat(unserialize(data.body));
                facebookAPI.updateNote(note.id, {"body": serialize(newDiff)}, callback);
            });
        }
    });
}

function compareFriends(previousFriends, friends, savedFriendsNoteId) {
    chrome.runtime.sendMessage({
        from:    'background',
        subject: 'processing',
        processing: true,
        text:    'Comparing friendlists'
    });

    var diff = [];

    var _diff = {};
    for (var i = 0; i < previousFriends.length; i++) {
        _diff[previousFriends[i].id] = {"action": "removed", "name": previousFriends[i].name};
    }

    for (var j = 0; j < friends.length; j++) {
        if (_diff[friends[j].id]) {
            delete _diff[friends[j].id];
        }
        else {
            _diff[friends[j].id] = {"action": "added", "name": friends[j].name};;
        }
    }

    var date = new Date();

    for (var k in _diff) {
        diff.push({
            "id": k,
            "action": _diff[k].action,
            "name": "" + _diff[k].name,
            "date": date.toLocaleDateString()
        });
    }

    if (diff.length > 0) {
        // there are changes, save them
        saveChanges(diff, function() {
            // update revisited note
            facebookAPI.updateNote(savedFriendsNoteId, {"body": serialize(friends)}, finishedUpdating);
        });
    }
    else {
        finishedUpdating();
    }
}

function checkChanges() {
    console.log("check started");

    processing = true;
    chrome.runtime.sendMessage({
        from:    'background',
        subject: 'processing',
        processing: true,
        text:    'Getting current friend list'
    });

    facebookAPI.getFriends(function(friends) {
        chrome.runtime.sendMessage({
            from:    'background',
            subject: 'processing',
            processing: true,
            text:    'Getting stored friend list'
        });

        facebookAPI.findNoteByTitle("Current Friend List", function(note) {
            if (!note) {
                facebookAPI.createNote({"title": "Current Friend List", "body": serialize(friends)}, finishedUpdating);
            }
            else {
                // get stored friend list
                facebookAPI.getNote(note.id, function(data) {
                    var previousFriends = unserialize(data.body);
                    compareFriends(previousFriends, friends, note.id);
                });
            }
        });
    });
}

function getChanges() {
    facebookAPI.findNoteByTitle("Friend List Changes", function(note) {
        facebookAPI.getNote(note.id, function(data) {
            var changes = unserialize(data.body);

            chrome.runtime.sendMessage({
                from:    'background',
                subject: 'changesList',
                changes: changes
            });
        });
    });
}

function getFriendlist() {
    facebookAPI.findNoteByTitle("Current Friend List", function(note) {
        facebookAPI.getNote(note.id, function(data) {
            var list = unserialize(data.body);

            chrome.runtime.sendMessage({
                from:    'background',
                subject: 'friendlist',
                list: list
            });
        });
    });
}

chrome.runtime.onMessage.addListener(function(msg, sender, response) {
    console.log(msg);

    if (msg.from === "content" && msg.subject === "init") {
        chrome.pageAction.show(sender.tab.id);
    }

    if (msg.subject === 'checkChanges') {
        checkChanges();
    }

    if (msg.subject === 'getChanges') {
        getChanges();
    }

    if (msg.subject === 'getStatus') {
        response(processing);
    }

    if (msg.subject === 'getFriendlist') {
        getFriendlist();
    }
});
