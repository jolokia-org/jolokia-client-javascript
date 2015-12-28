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

    var j4p = new Jolokia(JOLOKIA_URL);

    module("Simplified requests");
    test("getAttribute (sync)", function () {
        var value = j4p.getAttribute("java.lang:type=Memory", "HeapMemoryUsage", "used");
        ok(value > 0, "Positive used HeapMemory");
        value = j4p.getAttribute("java.lang:type=Memory", "HeapMemoryUsage");
        ok(value.used, "Composite Data returned");
        value = j4p.getAttribute("java.lang:type=Memory", ["HeapMemoryUsage", "NonHeapMemoryUsage"]);
        ok(value.HeapMemoryUsage.max, "Multi attribute read, HeapMemoryUsage.max");
        ok(value.NonHeapMemoryUsage.used, "Multi attribute read, HeapMemoryUsage.used");
        value = j4p.getAttribute("java.lang:type=Memory");
        ok(value.HeapMemoryUsage.max, "All attribute read, HeapMemoryUsage.max");
        ok(value.NonHeapMemoryUsage.used, "All attribute read, HeapMemoryUsage.used");
        value = j4p.getAttribute("java.lang:type=*");
        ok(value["java.lang:type=Memory"].HeapMemoryUsage.max,
          "Pattern read, java.lang:type=Memory,HeapMemoryUsage.max");
        raises(function () {
            j4p.getAttribute("bla:blub=x", {method: "get"})
        }, "Error call");
    });

    test("getAttribute with strange name (sync)", function () {
        equal(j4p.getAttribute("jolokia.it:name=\",,/,,\",type=escape", "Ok"), "OK");
    });

    test("getAttribute (sync with error)", function (assert) {
        var done = assert.async(2);

        var value = j4p.getAttribute("bla:blub=x", {
            error: function (resp) {
                equal(resp.error_type, "javax.management.InstanceNotFoundException", "Exception type");
                done()
            }
        });
        ok(value == null, "Error call");
        done();
    });


    test("getAttribute (async)", function (assert) {
        var done = assert.async();

        var value = j4p.getAttribute("java.lang:type=Memory", "HeapMemoryUsage", "used", {
            success: function (val) {
                ok(val > 0, "Positive HeapMemory");
                done();
            }
        });
    });

    test("setAttribute (sync)", function () {
        var oldValue = j4p.getAttribute("java.lang:type=Threading", "ThreadCpuTimeEnabled");
        var value = j4p.setAttribute("java.lang:type=Threading", "ThreadCpuTimeEnabled", oldValue ? false : true);
        equal(oldValue, value, "Old-Value should be returned");
        value = j4p.setAttribute("java.lang:type=Threading", "ThreadCpuTimeEnabled", value ? false : true);
        ok(oldValue != value, "Alternate state");
        value = j4p.setAttribute("jolokia.it:type=attribute", "ComplexNestedValue", 23, "Blub/1/numbers/0");
        equal(value, 42);
        equal(j4p.getAttribute("jolokia.it:type=attribute", "ComplexNestedValue", "Blub/1/numbers/0"), 23);
        j4p.execute("jolokia.it:type=attribute", "reset");
    });

    test("setAttribute (sync with error)", function (assert) {
        var done = assert.async(2);

        var value = j4p.setAttribute("bla:blub=x", "x", 10, {
            error: function (resp) {
                equal(resp.error_type, "javax.management.InstanceNotFoundException", "Exception type");
                done();
            }
        });
        ok(value == null, "Error call");
        done();
    });

    test("setAttribute (async)", function (assert) {
        var done = assert.async(2);

        var value = j4p.setAttribute("jolokia.it:type=attribute", "ComplexNestedValue", 23, "Blub/1/numbers/0",
          {
              success: function (val) {
                  equal(val, 42, "Old value returned");
                  j4p.getAttribute("jolokia.it:type=attribute", "ComplexNestedValue", "Blub/1/numbers/0", {
                      success: function (nval) {
                          equal(nval, 23, "New value set");
                          j4p.execute("jolokia.it:type=attribute", "reset");
                          done();
                      }
                  })
              }
          });
        equal(value, null, "No return value for async operations");
        done();
    });

    test("execute (sync)", function () {
        var value = j4p.execute("jolokia.it:type=operation", "fetchNumber", "inc");
        equal(value, 0);
        value = j4p.execute("jolokia.it:type=operation", "fetchNumber", "inc");
        equal(value, 1);
        value = j4p.execute("jolokia.it:type=operation", "overloadedMethod(java.lang.String,int)", "bla", 1);
        equal(value, 2);
        value = j4p.execute("jolokia.it:type=operation", "arrayArguments", "Max\nMorlock,blub", "x", {method: "POST"});
        equal(value, "Max\nMorlock");
        value = j4p.execute("jolokia.it:type=operation", "arrayArguments", ["Max\nMorlock", "blub"], "x",
          {method: "POST"});
        equal(value, "Max\nMorlock");
        value = j4p.execute("jolokia.it:type=operation", "nullArgumentCheck", null, null);
        equal(value, true);
        j4p.execute("jolokia.it:type=operation", "reset");
    });

    test("execute (sync) with escape", function () {
        equal(j4p.execute("jolokia.it:type=operation", "echo", "blub!"), "blub!");
        equal(j4p.execute("jolokia.it:type=operation", "echo", "blub!!"), "blub!!");
        equal(j4p.execute("jolokia.it:type=operation", "echo", "blub!/!"), "blub!/!");
        equal(j4p.execute("jolokia.it:type=operation", "echo", "blub!//!"), "blub!//!");
    });


    test("execute (sync with error)", function (assert) {
        var done = assert.async();

        var value = j4p.execute("jolokia.it:type=operation", "throwCheckedException", {
            error: function (resp) {
                equal(resp.error_type, "java.lang.Exception");
                done();
            }
        });
    });

    test("execute (async)", function (assert) {
        var done = assert.async(2);

        var value = j4p.execute("jolokia.it:type=operation", "nullArgumentCheck", null, null, {
            success: function (value) {
                equal(value, true);
                done();
            }
        });
        equal(value, null);
        done();
    });

    test("search (sync)", function () {
        var value = j4p.search("jolokia.it:*");
        ok($.isArray(value), "Return value from search must be an array");
        ok(value.length > 2, "Array must contain mbeans");
        $.each(value, function (i, val) {
            ok(typeof val == "string", "MBean name must be a string");
            ok(val.match(/^jolokia\.it:.*/), "MBean name must start with domain name");
        });
    });

    test("search (no result, sync)", function () {
        var value = j4p.search("bla:notype=*");
        ok($.isArray(value), "Return value from search must be an array");
        equal(value.length, 0, "List must be empty");
    });

    test("search (sync with error)", function (assert) {
        var done = assert.async(2);

        var value = j4p.search("jolokia.it:type=*=a*", {
            error:      function (resp) {
                ok(resp.error != null, "Error occured");
                done();
            }, success: function () {
                fail();
            }
        });
        equal(value, null);
        done();
    });

    test("search (async)", function (assert) {
        var done = assert.async();

        var value = j4p.search("jolokia.it:*", {
            success: function (val) {
                ok($.isArray(val), "Return value from search must be an array");
                ok(val.length > 2, "Array must contain mbeans");
                done();
            }
        });
    });


    test("version (sync)", function () {
        var value = j4p.version({method: "post"});
        ok(value.protocol >= 6, "Protocol >= 4");
        ok(checkVersion(value.agent,j4p.VERSION), "Client version: " + j4p.VERSION);
    });

    test("version (async)", function (assert) {
        var done = assert.async(2);
        var value = j4p.version({
            jsonp: true, success: function (val) {
                ok(checkVersion(val.agent,j4p.VERSION), "Agent version " + j4p.VERSION);
                done();
            }
        });
        ok(!value);
        done();
    });


    test("list (sync)", function () {
        var value = j4p.list("java.lang/type=Memory/op");
        ok(value["gc"], "Garbage collection");
        value = j4p.list(["java.lang", "type=Memory", "op"]);
        ok(value["gc"], "Garbage collection (with array path)");
        equal(value.gc.args, 0);
        value = j4p.list("jolokia.it/name=n!!a!!m!!e with !!!/!!,type=naming!//attr");
        ok(value["Ok"], "Path with /");
        value = j4p.list(["jolokia.it", "type=naming/,name=n!a!m!e with !/!", "attr"]);
        ok(value["Ok"], "Path with / (path elements)");
        raises(function () {
            j4p.list("java.lang/type=Bla");
        }, "Invalid path");
        raises(function () {
            j4p.list("jolokia.it/type=naming,name=n!a!m!e with !/!/attr");
        }, "Invalid path with slashes");
    });

    test("list (sync with error)", function (assert) {
        var done = assert.async(2);
        var value = j4p.list("java.lang/type=Bla", {
            error: function (resp) {
                equal(resp.error_type, "java.lang.IllegalArgumentException", "java.lang.IllegalArgumentException");
                done();
            }
        });
        ok(!value);
        done();
    });


    test("list (async)", function (assert) {
        var done = assert.async(2);
        var value = j4p.list("java.lang/type=Memory/attr", {
            success: function (val) {
                ok(val["HeapMemoryUsage"] != null, "HeapMemory");
                done();
            }
        });
        ok(!value);
        done();
    });

    function checkVersion(agent,client) {
        // No version check yet ...
        return true;
    }

});

