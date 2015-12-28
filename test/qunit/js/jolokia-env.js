(function() {
    var port = 8080;
    if (window.location.search) {
        var params = window.location.search.match(/port=(\d+)/);
        if (params[1]) {
            port = params[1];
        }
    }
    window.JOLOKIA_URL = "http://localhost:" + port + "/jolokia";
})();
