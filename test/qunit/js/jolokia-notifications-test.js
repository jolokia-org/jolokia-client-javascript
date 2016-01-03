/*
 * Copyright 2009-2013 Roland Huss
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

$(document).ready(function () {
    module("Notifications");

    var j4p = new Jolokia(JOLOKIA_URL);
    j4p.start(1000);

    test("Simple notification (SSE)",function(assert) {
        testSimpleNotification(assert,"sse")
    });

    test("Simple notification (Pull)",function(assert) {
        testSimpleNotification(assert,"pull")
    });

    QUnit.moduleDone(function(details) {
        if (details.name === "Notifications") {
            j4p.destroy();
        }
    });

    function testSimpleNotification(assert,mode) {
        var done = assert.async();

        // Register listener
        var handle;

        j4p.onNotification({
            mode:  mode,
            mbean: "jolokia.it:type=Chat"
        }, function(notifs) {
            equal(notifs.notifications.length,1,"One notification received");
            var data = notifs.notifications[0].userData;
            equal(data.user,"roland","User name");
            equal(data.message,"jolokia rocks!","Message");

            // Unregister listener
            j4p.offNotification(handle);
            done();
        }, function(h) {
            handle = h;
            // Call MBean
            j4p.execute("jolokia.it:type=Chat","message","roland","jolokia rocks!", {
                // Make it async
                success: function() {}
            });
        });
    }
});
