chrome.runtime.onMessage.addListener(function(msg, sender, response) {
    if ((msg.from === 'popup') && (msg.subject === 'getTabPlugin')) {
        response();
    }
});

chrome.runtime.sendMessage({
    from:    'content',
    subject: 'init'
});

// inject background js
var s = document.createElement('script');
s.src = chrome.extension.getURL('public.js');
(document.head||document.documentElement).appendChild(s);
s.onload = function() {
    s.parentNode.removeChild(s);
};