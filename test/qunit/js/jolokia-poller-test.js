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

// Poller tests

$(document).ready(function() {

    module("Poller");
    test("Simple registered request",function(assert) {
        var done = assert.async();

        var counter1 = 1,
            counter2 = 1;
        var j4p = new Jolokia(JOLOKIA_URL);

        j4p.register(function(resp) {
            counter1++;
        },{ type: "READ", mbean: "java.lang:type=Memory", attribute: "HeapMemoryUsage", path: "used"});
        j4p.register(function(resp) {
            counter2++;
        },{ type: "READ", mbean: "java.lang:type=Memory", attribute: "HeapMemoryUsage", path: "max"});

        equal(j4p.jobs().length,2,"Two jobs registered");

        ok(!j4p.isRunning(),"Poller should not be running");
        j4p.start(100);
        ok(j4p.isRunning(),"Poller should be running");
        setTimeout(function() {
            j4p.stop();
            ok(!j4p.isRunning(),"Poller should be stopped");
            equal(counter1,3,"Request1 should have been called 3 times");
            equal(counter2,3,"Request2 should have been called 3 times");
            done();
        },280);
    });

    test("Starting and stopping",function(assert) {
        var done = assert.async();

        var j4p = new Jolokia(JOLOKIA_URL);
        var counter = 1;

        j4p.register(function(resp) {
            counter++;
            },{ type: "READ", mbean: "java.lang:type=Memory", attribute: "HeapMemoryUsage", path: "used"},
            { type: "SEARCH", mbean: "java.lang:type=*"});
        j4p.start(100);
        setTimeout(function() {
            j4p.stop();
            setTimeout(function() {
                equal(counter,4,"Request should have been called 4 times")
                ok(!j4p.isRunning(),"Poller should be stopped");
                done();
            },300);
        },350);

    });

    test("Registering- and Deregistering",function(assert) {
        var done = assert.async();

        var j4p = new Jolokia(JOLOKIA_URL);
        var counter1 = 0,
            counter2 = 0;
        var id1 = j4p.register(function(resp) {
            counter1++;
        },{
            type: "READ",
            mbean: "java.lang:type=Memory",
            attribute: "HeapMemoryUsage",
            path: "used"
        });
        var id2 = j4p.register(function(resp) {
            counter2++;
        },{
            type: "EXEC",
            mbean: "java.lang:type=Memory",
            operation: "gc"
        });
        setTimeout(function() {
            var interval = 200;
            var deltaCheck = 1000;
            j4p.start(interval);
            equal(j4p.jobs().length,2,"2 jobs registered");
            setTimeout(function() {
                ok(counter1 > 0,"Req1 called more than once (counter: " + counter1 + " after " + (interval + deltaCheck) + " ms)");
                ok(counter2 > 0,"Req2 called more than once (counter: " + counter2 + " after " + (interval + deltaCheck) + " ms)");
                equal(counter1, counter2, "Req1 and Req2 called as often");
                j4p.unregister(id1);
                var oldCounter1 = counter1;
                var oldCounter2 = counter2;
                equal(j4p.jobs().length,1,"1 job remaining");
                setTimeout(function() {
                    // It can increase by one if the unregister() happened after a the request has bee already
                    // issued to the backend.
                    ok(counter1 == oldCounter1 || counter1 == oldCounter1 + 1,
                          "Req1 counters didn't increase more than one since it was unregistered (" +
                          oldCounter1 + " <= " + counter1 + ")");
                        ok(counter2 > oldCounter2, "Req2 should continue to be requested " +
                                               "(counter: " + counter2 + " after " + (interval + deltaCheck) + " ms");
                    oldCounter2 = counter2;
                    j4p.unregister(id2);
                    equal(j4p.jobs().length,0,"No job remaining");
                    // Handles should stay stable, so the previous unregister of id1 should not change
                    // the meaining of id2 (see http://jolokia.963608.n3.nabble.com/Possible-bug-in-the-scheduler-tp4023893.html
                    // for details)
                    setTimeout(function() {
                        j4p.stop();
                        ok(counter1 == oldCounter1 || counter1 == oldCounter1 + 1,
                          "Req1 counters didn't increase more than one since it was unregistered (" +
                          oldCounter1 + " <= " + counter1 + ")");
                        // It can increase by one if the unregister() happened after a the request has bee already
                        // issued to the backend.
                        ok(counter2 == oldCounter2 || counter2 == oldCounter2 + 1,
                          "Req2 counters didn't increase more than one since it was unregistered (" +
                          oldCounter2 + " <= " + counter2 + ")");
                        done();
                    }, interval + deltaCheck);
                }, interval + deltaCheck);
            }, interval + deltaCheck);
        },100);
    });

    test("Multiple requests",function(assert) {
        var done = assert.async();

        var j4p = new Jolokia(JOLOKIA_URL);
        j4p.register(function(resp1,resp2,resp3,resp4) {
            j4p.stop();
            equal(resp1.status,200);
            equal(resp2.status,200);
            ok(resp1.value > 0);
            ok(resp2.value > 0);
            equal(resp1.request.attribute,"HeapMemoryUsage");
            equal(resp2.request.attribute,"ThreadCount");
            equal(resp3.status,404);
            ok(!resp4);
            done();
        },{ type: "READ", mbean: "java.lang:type=Memory", attribute: "HeapMemoryUsage", path: "used"},
          { type: "READ", mbean: "java.lang:type=Threading", attribute: "ThreadCount"},
          { type: "READ", mbean: "bla.blu:type=foo", attribute: "blubber"});
        setTimeout(function() {
            j4p.start(500)
        },200);
    });

    test("Config merging",function(assert) {
        var done = assert.async();

        var j4p = new Jolokia(JOLOKIA_URL);
        j4p.register({
                callback: function(resp1,resp2) {
                    ok(!resp1.error_value);
                    ok(resp1.stacktrace);
                    ok(resp2.error_value);
                    ok(!resp2.stackTrace);
                },
                config: {
                    serializeException: true
                }
            },
            { type: "READ", mbean: "bla.blu:type=foo", attribute: "blubber", config: { serializeException: false}},
            { type: "READ", mbean: "bla.blu:type=foo", attribute: "blubber", config: { includeStackTrace: false}}
        );
        j4p.start(200);
        setTimeout(function() {
            j4p.stop();
            done();
        },400);
    });

    test("OnlyIfModified test - callback",function(assert) {
        var done = assert.async();

        var j4p = new Jolokia(JOLOKIA_URL);
        var counter = {
            1: 0,
            3: 0
        };
        j4p.register({
                callback: function() {
                    counter[arguments.length]++;
                },
                onlyIfModified: true
            },
            { type: "LIST", config: { maxDepth: 2}},
            { type: "LIST", config: { maxDepth: 1}},
            { type: "READ", mbean: "java.lang:type=Memory", attribute: "HeapMemoryUsage", path: "used"}
        );
        j4p.start(200);
        setTimeout(function() {
            j4p.stop();
            equal(counter[3],1);
            equal(counter[1],1);
            done();
        },500);
    });

    test("OnlyIfModified test - success and error ",function(assert) {
        var done = assert.async();

        var j4p = new Jolokia(JOLOKIA_URL);
        var counter = 0;
        j4p.register({
                success: function(resp1) {
                    counter++;
                },
                error: function(resp1) {
                    counter++;
                },
                onlyIfModified: true
            },
            { type: "LIST", config: { maxDepth: 2}}
        );
        j4p.start(200);
        setTimeout(function() {
            j4p.stop();
            // Should have been called only once
            equal(counter,1);
            done();
        },600);
    });

    test("Multiple requests with success/error callbacks",function(assert) {
        var done = assert.async();

        var j4p = new Jolokia(JOLOKIA_URL);
        var counterS = 0,
            counterE = 0;
        j4p.register({
                success: function(resp) {
                    counterS++;
                },
                error: function(resp) {
                    counterE++;
                    equal(resp.status,404);
                }
            },
            { type: "READ", mbean: "java.lang:type=Memory", attribute: "HeapMemoryUsage", path: "used"},
            { type: "READ", mbean: "java.lang:type=Threading", attribute: "ThreadCount"},
            { type: "READ", mbean: "bla.blu:type=foo", attribute: "blubber"});
        setTimeout(function() {
            j4p.start(200);
            setTimeout(function () {
                j4p.stop();
                equal(counterS, 4, "Req should be called 4 times successfully");
                equal(counterE, 2, "One error request, twice");
                done();
            }, 500);
        },100);
    });

});
