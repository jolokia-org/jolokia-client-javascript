(function() {
    var port = 8080;
    if (window.location.search) {
        var params = window.location.search.match(/port=(\d+)/);
        if (params) {
            port = params[1];
        }

        // How often to poll
        params = window.location.search.match(/pollInterval=(\d+)/);
        if (params) {
            window.JOLOKIA_POLL_INTERVAL = parseInt(params[1]);
        }
    }

    window.JOLOKIA_URL = "http://localhost:" + port + "/jolokia";
})();
