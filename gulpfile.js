var gulp = require('gulp'),
  p = require('./package.json'),
  uglify = require('gulp-uglify'),
  rename = require('gulp-rename'),
  replace = require('gulp-replace'),
  gzip = require('gulp-gzip'),
  del = require('del'),
  runSequence = require('run-sequence'),
  qunit = require('gulp-qunit'),
  remoteSrc = require('gulp-remote-src'),
  minimist = require('minimist'),
  gutil = require('gulp-util'),
  tomcat = require('./tools/tomcat.js');

// Where to create the files
var buildDir = "build";

var JOLOKIA_VERSION = "2.0.0-SNAPSHOT";

var DEFAULT_SUPPORT_LIB="jquery-1";
var SUPPORT_LIB_MAP = {
    "zepto" : "zepto-1.1.6.js",
    "jquery-1" : "jquery-1.11.3.js",
    "jquery-2" : "jquery-2.1.4.js"
}

// Options
var optionsCfg = {
    string: [ "test", "version", "supportLib", "pollInterval" ],
    boolean: [ "force", "jvmAgent"],

    default: {
        force: false,
        jvmAgent: false,
        version: JOLOKIA_VERSION
    }
};

var options = minimist(process.argv.slice(2), optionsCfg);
options.port = options.jvmAgent ? 8778 : 8080;

var scripts = "src/*.js";

gulp.task('clean', function() {
    del(buildDir + "/*");
    del("tomcat");
});

gulp.task('default', function() {
    return gulp.src(scripts)
      .pipe(replace(/\[\[\s*VERSION\s*]]/g, p.version))
      .pipe(gulp.dest(buildDir))
      .pipe(uglify())
      .pipe(gzip())
      .pipe(rename({suffix : '-min'}))
      .pipe(gulp.dest(buildDir + '/min/'))
});

gulp.task('start', function(done) {
    tomcat.init(options,function() {
        tomcat.start(done);
    })
});

gulp.task('stop', function(done) {
    tomcat.stop(done);
});

gulp.task('supportLib', function() {
    var supportLib = options.supportLib || DEFAULT_SUPPORT_LIB;
    supportLib = SUPPORT_LIB_MAP[supportLib] || supportLib;

    return gulp.src("test/support/" + supportLib)
      .pipe(gutil.log("Using " + gutil.colors.green(supportLib) + " for testing") && gutil.noop())
      .pipe(rename("support-lib.js"))
      .pipe(gulp.dest(buildDir + "/support/"));
});

gulp.task('qunit', [ 'supportLib' ], function() {
    var file = options.test ? options.test : "jolokia-all-test.html";
    var url = 'test/qunit/' + file + "?port=" + options.port;
    if (options.pollInterval) {
        url += "&pollInterval=" + options.pollInterval;
    }
    return remoteSrc(url, {
        base: "http://localhost:8080/jolokia-js/"
    }).pipe(qunit({
        'phantomjs-options': [ "--web-security=" + (options.jvmAgent ? "false" : "true") ],
        timeout: options.pollInterval ? options.pollInterval * 40 : 20
    }));
});

gulp.task('test', function(done) {
    runSequence('default', 'start', 'qunit', function(error) {
        tomcat.stop(function() {
            done();
            process.exit(error ? 1 : 0);
        });
    });
});

gulp.task('watch', function() {
    gulp.watch(scripts,['default']);
});

