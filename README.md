## Jolokia JavaScript client

This repository holds the JavaScript client library for accessing
[Jolokia](https://www.jolokia.org) from the browser. It requires
jQuery 1 or 2, or zepto.

It provides the following highlights:

* Full support of the Jolokia protocoal:
  - `READ` and `WRITE` requests  
  - `EXEC` operations
  - `LIST` of all MBeans
  - `SEARCH` for MBeans
  - `NOTIFICATION` support
* Asynchronous and synchronous operations
* Scheduler for periodically sending Jolokia requests
* Simplified API for simple use cases
* [Cubism.js](https://square.github.io/cubism/) support
* Notification support for the *pull* and *sse* mode.

### Gulp Build System

The build uses gulp and knows the following tasks

Task    | Description
--------|-----------------
`clean` | Cleanup everything
`start` | Start a Tomcat 8 server with a Jolokia 2.0.0 agent attached
`stop`  | Stop a previously started server
`test`  | Run the QUnit Testsuite with Phantom.js
`demo`  | Start the Tomcat server and open browser to the demo page

These task also support the following options

Option           | Description
-----------------|------------------
`--jvmAgent`     | Use the JVM instead of the WAR agent
`--pollInterval` | How long to use the poll interval for scheduler when doing the tests (default: 500ms)
`--version`      | Jolokia version to use for the agent (2.0.0-M1 by default)
`--supportLib`   | Which support lib for the tests should be used: `jquery-1`, `jquery-2` or `zepto`

Examples:

```
# Run whol test suite with the Jolokia WAR agent
gulp test

# Tests with the JVM agent
gulp test --jvmAgent

# Start the server, open the default browser at http://localhost:8080/demo
gulp demo
```

### Soon to come:

* Bower packaging
* Abstracting jQuery away (which is used for doing the Ajax call)
* Support for node.js as client (currenlty a Browser environment is required)
* Internal modularization of the code
* Including `java-simple.js` into `jolokia.js`
* More examples
* Dedicated documentation


It is intended to be a drop in replacement for the Jolokia 1.x client
and can be used with a Jolokia 1.x client, too (obviously not for the
new notification support).

### The new one ...

This here is the new location of the [Jolokia](https://www.jolokia.org)
2.0 JavaScript client. For the 1.x series it is part of Jolokia
itself. The most up-to-date documentation can still be found in the
[Jolokia Reference Manual](https://jolokia.org/reference/html/clients.html#client-javascript)
but will gradually be moved to this repository. 

The new 2.0 features of the JavaScript client are:

* Notification support
* New build system with automatic setup of the test environment
* Automated integration tests with QUnit and Phantom.js
* CircleCI integration

