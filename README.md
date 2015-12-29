## Jolokia JavaScript client

This is the new location of the [Jolokia](https://www.jolokia.org) 2.0. JavaScript client, which currently is part of Jolokia itself.

The most up-to-date documentation can be found in the [Jolokia Reference Manual](https://jolokia.org/reference/html/clients.html#client-javascript).

For 2.0, the clients get their own repository and enhanced features.

In addition to the 1.x features, this client supports:

* Notification support
* New build system with automatic setup of the test environment
* Automated integration tests with QUnit and Phantom.js
* CircleCI integration

Soon to come:

* Bower packaging
* Abstracting jQuery away (which is used for doing the Ajax call)
* Support for node.js as client (currenlty a Browser environment is required)
* Internal modularization of the code
* Including `java-simple.js` into `jolokia.js`
* More examples
* Dedicated documentation


It is intended to be a drop in replacement for the Jolokia 1.x client and can be used with a Jolokia 1.x client, too (obviously not for the new notification support).
