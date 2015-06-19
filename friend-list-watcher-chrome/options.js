function setProcessing(processing, text) {
    if (processing) {
        document.querySelector("#checking-changes .text").textContent = text;

        document.querySelector("#check-changes").style.display = 'none';
        document.querySelector("#checking-changes").style.display = 'block';
    }
    else {
        document.querySelector("#check-changes").style.display = 'block';
        document.querySelector("#checking-changes").style.display = 'none';

        // always get changes on success
        chrome.runtime.sendMessage({from: "options", subject: "getChanges"});
    }
}

var downloadFormat = "json";
function downloadData(friendlist) {
    if (downloadFormat == "json") {
        var blob = new Blob([JSON.stringify(friendlist, null, 4)],{type:"text/json"});
        chrome.downloads.download({"url": window.URL.createObjectURL(blob), "filename": "friendlist.json" });
    }

    if (downloadFormat == "csv") {
        var csv = "";
        for (var i = 0; i < friendlist.length; i++) {
            var friend = friendlist[i];
            csv += friend.id + ";" + friend.name + "\n";
        }

        var blob = new Blob([csv],{type:"text/csv"});
        chrome.downloads.download({"url": window.URL.createObjectURL(blob), "filename": "friendlist.csv" });
    }
}

function loadChanges(changes) {
    console.log(changes);
    document.querySelector("#changes-list").innerHTML = "";

    for (var i = 0; i < changes.length; i++) {
        var change = changes[i];
        var template = document.querySelector("#change-template div").cloneNode(true);

        template.querySelector(".name").innerText = change.name;
        template.querySelector(".date").innerText = change.date;

        if (change.action == "added") {
            template.querySelector(".removed").style.display = 'none';
            template.classList.add("alert-success");
        }

        if (change.action == "removed") {
            template.querySelector(".added").style.display = 'none';
            template.classList.add("alert-danger");
        }

        template.querySelector("img").setAttribute("src", "https://graph.facebook.com/" + change.id + "/picture?type=square");

        document.querySelector("#changes-list").appendChild(template);
    }
}

window.addEventListener("DOMContentLoaded", function() {
    //chrome.runtime.sendMessage({from: "popup", subject: "getOrders"}, getOrders);
    chrome.runtime.onMessage.addListener(function(msg, sender) {
        if (msg.from === 'background' && msg.subject === 'updateOrders') {
        }

        if (msg.from === "background" && msg.subject === "processing") {
            setProcessing(msg.processing, msg.text);
        }

        if (msg.from === "background" && msg.subject === "changesList") {
            loadChanges(msg.changes);
        }

        if (msg.from === "background" && msg.subject === "friendlist") {
            downloadData(msg.list);
        }
    });

    chrome.runtime.sendMessage({from: "options", subject: "getStatus"}, function(processing) {
        setProcessing(processing);
    });

    document.querySelector("#check-changes").addEventListener("click", function(e) {
        e.preventDefault();
        chrome.runtime.sendMessage({from: "options", subject: "checkChanges"});
    });


    document.querySelector("#download-json").addEventListener("click", function(e) {
        e.preventDefault();
        downloadFormat = "json";
        chrome.runtime.sendMessage({from: "options", subject: "getFriendlist"});
    });

    document.querySelector("#download-csv").addEventListener("click", function(e) {
        e.preventDefault();
        downloadFormat = "csv";
        chrome.runtime.sendMessage({from: "options", subject: "getFriendlist"});
    });
});

