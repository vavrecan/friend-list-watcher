setTimeout(function() {
    // todo: injectable JS
    document.dispatchEvent(new CustomEvent('...', {
        detail: {
            "data": 1
        }
    }));
}, 0);
