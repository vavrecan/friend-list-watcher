function setProcessing(processing, text) {
    if (processing) {
        document.querySelector("#checking-changes .text").textContent = text;

        document.querySelector("#check-changes").style.display = 'none';
        document.querySelector("#checking-changes").style.display = 'block';
    }
    else {
        document.querySelector("#check-changes").style.display = 'block';
        document.querySelector("#checking-changes").style.display = 'none';
    }
}

window.addEventListener("DOMContentLoaded", function() {
    chrome.tabs.query({
        active: true,
        currentWindow: true
    }, function(tabs) {
        var tabId = tabs[0].id;
        chrome.tabs.sendMessage(tabId, {from: "popup", subject: "getTabPlugin"}, function() {
        });

    });

    chrome.runtime.onMessage.addListener(function(msg, sender, response) {
        if (msg.from === "background" && msg.subject === "processing") {
            setProcessing(msg.processing, msg.text);
        }
    });

    chrome.runtime.sendMessage({from: "popup", subject: "getStatus"}, function(processing) {
        setProcessing(processing);
    });

    document.querySelector("#check-changes").addEventListener("click", function(e) {
        e.preventDefault();
        chrome.runtime.sendMessage({from: "popup", subject: "checkChanges"});
    });

    document.querySelector("#extension-url").setAttribute("href", "chrome-extension://" + chrome.i18n.getMessage("@@extension_id") + "/options.html");
});

