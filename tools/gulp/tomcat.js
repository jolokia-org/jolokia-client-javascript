'use strict';

var p = require('../../package.json'),
  rimraf = require('rimraf'),
  fs = require('fs'),
  http = require('http'),
  https = require('https'),
  tar = require('tar-fs'),
  gunzip = require('gunzip-maybe'),
  process = require('process'),
  child_process = require('child_process'),
  path = require('path'),
  gutil = require('gulp-util'),
  xml2js = require('xml2js'),
  tty = require('tty'),
  ProgressBar = require('progress');

module.exports = (function() {

    var tomcatUrl = "http://www.eu.apache.org/dist/tomcat/tomcat-8/v"
                      + p.testVersions.tomcat + "/bin/apache-tomcat-" + p.testVersions.tomcat + ".tar.gz";
    var mavenCentralRepo = "http://repo1.maven.org/maven2";
    var mavenCentralSnapshotRepo = "https://oss.sonatype.org/content/repositories/snapshots";

    var jolokiaWarCoords="org.jolokia:jolokia-agent-war";
    var jolokiaItWarCoords="org.jolokia:jolokia-it-war";
    var jolokiaJvmAgentCoords="org.jolokia:jolokia-agent-jvm";

    var tomcatDir = "tomcat";

    return {
        start: function (done) {
            var prc = execTomcat('jpda', 'run');

            function waitForTomcatStartup(data) {
                var str = data.toString();
                if (str.match(/Server startup/i)) {
                    done();
                }
            }

            prc.stdout.on('data', waitForTomcatStartup);
            prc.stderr.on('data', waitForTomcatStartup);
            prc.on('close', function (code) {
                gutil.log('Tomcat exit code ' + code);
            });
            gutil.log(gutil.colors.green("Started Tomcat"));
        },

        stop: function (done) {
            var ret = execTomcat("stop", "1", "-force");
            gutil.log(gutil.colors.green("Stopped Tomcat"));
            done();
        },

        init: function(opts,done) {
            if (opts && opts.force) {
                removeIfExists(tomcatDir);
            }
            if (!directoryExists(tomcatDir)) {
                var req = http.request(tomcatUrl);
                req.on("response",  function(response) {
                    createProgressBar('apache-tomcat-' + p.testVersions.tomcat,response);
                    if (response.statusCode != 200) {
                        gutil.log(gutil.colors.red("Got HTTP error while fetching " + tomcatUrl + " : "
                                                   + response.statusCode + " - " + response.statusMessage));
                        done();
                    }
                    response
                      .on('end', function () {
                          addStaticContent(tomcatDir + "/conf/server.xml",path.resolve(__dirname + "/../.."));
                          initAgent(opts,done);
                      })
                      .pipe(gunzip())
                      .pipe(tar.extract(tomcatDir, { strip: 1 }))
                }).on('error', function(e) {
                    gutil.log(gutil.colors.red("Got HTTP error while fetching " + tomcatUrl + " : " + e.message));
                    done();
                });
                req.end();
            } else {
                initAgent(opts,done);
            }
        },
    };

    function initAgent(opts,done) {
        var version = opts.version;

        if (opts && opts.jvmAgent) {
            deployJolokiaJvmAgent(version,opts,function() {
                createJvmAgentConfig();
                removeJolokiaWar();
                deployWar(jolokiaItWarCoords + ":" + version, "jolokia-it.war", opts, done);
            });
        } else {
            removeJvmConfig();
            deployWar(jolokiaWarCoords + ":" + version,"jolokia.war",opts,function() {
                deployWar(jolokiaItWarCoords + ":" + version,"jolokia-it.war",opts,done);
            });
        }
    }

    function deployWar(mavenCoords,dest,opts,done) {
        var destPath = tomcatDir + "/webapps/" + dest;
        if (fileExists(destPath) && ((opts && opts.force) || mavenCoords.match(/SNAPSHOT/))) {
            fs.unlinkSync(destPath);
        }
        if (!fileExists(destPath)) {
            fetchMavenArtifact(mavenCoords, "war", destPath, done)
        } else {
            done();
        }
    }

    function deployJolokiaJvmAgent(version,opts,done) {
        var destPath = tomcatDir + "/jolokia-agent.jar";
        if (fileExists(destPath) && ((opts && opts.force) || version.match(/SNAPSHOT/))) {
            fs.unlinkSync(destPath);
        }
        if (!fileExists(destPath)) {
            fetchMavenArtifact(jolokiaJvmAgentCoords + ":" + version + ":agent", "jar", destPath, done)
        } else {
            done();
        }
    }

    function createJvmAgentConfig() {
        // Create setenv.sh
        var agentOpts = "-javaagent:" + path.resolve(tomcatDir) + "/jolokia-agent.jar=port=8778,host=localhost";
        fs.writeFile(tomcatDir + "/bin/setenv.sh", "CATALINA_OPTS=\"" + agentOpts + "\"\n", 'utf8', function (err) {
            if (err) {
                throw new Error(err);
            }
        });
    }

    function removeJvmConfig() {
        var setenv = tomcatDir + "/bin/setenv.sh";
        if (fileExists(setenv)) {
            fs.unlinkSync(setenv);
        }
    }

    function removeIfExists(dir) {
        if (directoryExists(dir)) {
            rimraf.sync(dir);
        }
    }

    function removeJolokiaWar() {
        var warDir = tomcatDir + "/webapps/jolokia";
        removeIfExists(warDir);
        var war = warDir + ".war";
        if (fileExists(war)) {
            fs.unlinkSync(war);
        }
    }

    function fetchMavenArtifact(mavenCoords, extension, destPath, done) {
        var coords = mavenCoords.match(/^([^:]+):([^:]+):([^:]+)(?::?([^:]+))?$/);
        if (!coords) {
            throw new Error("Maven coords must be in the format groupId:artifactId:version and not " + mavenCoords);
        }
        var repo = getMavenRepoPath();
        var artifact = coords[2] + "-" + coords[3] + (coords[4] ? "-" + coords[4] : "") + "." + extension;
        var artifactLocationDir =
          coords[1].replace(".", "/") + "/" + coords[2] + "/" + coords[3];
        var artifactLocation = artifactLocationDir + "/" + artifact;
        var path = repo + "/" + artifactLocation;
        if (fileExists(path)) {
            // Use local artifact
            console.log(gutil.colors.grey("  Copying " + path + " to " + destPath));
            var is = fs.createReadStream(path);
            is
              .on('end', function () {
                  done();
              })
              .pipe(fs.createWriteStream(destPath));
        } else {
            // Download artifact or snapshot
            if (coords[3].match(/SNAPSHOT/)) {
                var metaUrl = mavenCentralSnapshotRepo + "/" + artifactLocationDir + "/maven-metadata.xml";
                https.get(metaUrl, function(res) {
                    var xml = '';

                    res.on('data', function(chunk) {
                        xml += chunk;
                    });

                    res.on('error', function(e) {
                        throw new Error("Cannot read " + metaUrl + ": " + e);
                    });

                    res.on('timeout', function(e) {
                        throw new Error("Timeout: Cannot read " + metaUrl + ": " + e);
                    });

                    res.on('end', function() {
                        xml2js.parseString(xml, { explicitArray: false }, function(err, meta) {
                            if (err) {
                                throw new Error("Invalid XML at " + metaUrl + ": " + err);
                            }
                            var snapshot = meta.metadata.versioning.snapshot;
                            var versionStem = coords[3].match(/^(.*)-SNAPSHOT$/)[1];
                            var resolvedArtifact = coords[2] + "-" + versionStem + "-" +
                                                   snapshot.timestamp + "-" + snapshot.buildNumber +
                                                   (coords[4] ? "-" + coords[4] : "") + "." + extension;
                            download(mavenCentralSnapshotRepo + "/" + artifactLocationDir + "/" + resolvedArtifact, artifact, destPath, done);
                        });
                    });
                });
            } else {
                download(mavenCentralRepo + "/" + artifactLocation, artifact, destPath, done);
            }
        }
    }

    function execTomcat() {
        var isWin = /^win/.test(process.platform);

        if (isWin) {
            var args = [ '/c', tomcatDir + "/bin/catalina.bat" ];
            for (var i = 0; i < arguments.length; i++) {
                args[i + 2] = arguments[i];
            }
            return child_process.spawn(process.env.comspec, args);
        } else {
            return child_process.spawn(tomcatDir + "/bin/catalina.sh", Array.prototype.slice.call(arguments));
        }
    }

    function download(url, label, destPath, done) {
        var downloader = url.match(/^https/) ? https : http;
        downloader.get(url, function(response) {
            if (response.statusCode != 200) {
                gutil.log(gutil.colors.red("Error while fetching " + url + ": " + response.statusMessage + " (" + response.statusCode + ")"));
                done();
            }
            createProgressBar(label, response);
            response
              .on('end', function () {
                  done();
              })
              .pipe(fs.createWriteStream(destPath));
        }).on('error', function(e) {
            console.log(gutil.colors.red("Got HTTP error while fetching " + url + " : " + e.message));
            done();
        });
    }

    function createProgressBar(what,response) {
        var len = parseInt(response.headers['content-length'], 10);
        if (tty.isatty(process.stdout.fd) && !process.env.CI) {
            var bar = new ProgressBar('  Downloading ' + what + ' [:bar] :percent :etas', {
                complete:   '=',
                incomplete: ' ',
                width:      40,
                total:      len
            });
            response
              .on('data',function (chunk) {
                  bar.tick(chunk.length);
              });
        } else {
            gutil.log("Downloading " + what);
        }
    }

    function fileExists(path) {
        try {
            return fs.statSync(path).isFile();
        } catch (err)  {
            return false;
        }
    }

    function directoryExists(path) {
        try {
            return fs.statSync(path).isDirectory();
        } catch (err)  {
            return false;
        }
    }

    function addStaticContent(settingsXml, rootDir) {
        fs.readFile(settingsXml, 'utf8', function (err,data) {
            if (err) {
                throw new Error(err);
            }
            var result = data.replace(/<\/Host>/i, '<Context docBase="' + rootDir + '" path="/jolokia-js" /></Host>');
            fs.writeFile(settingsXml, result, 'utf8', function (err) {
                if (err) {
                    throw new Error(err);
                }
            });
        });
    }

    function getMavenRepoPath() {
        var home = process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
        return home + "/.m2/repository";
    }
})();
