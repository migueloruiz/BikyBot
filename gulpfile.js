'use strict';

// node inspector

var gulp        = require('gulp');
var browserSync = require('browser-sync');
var nodemon     = require('gulp-nodemon');
var standard = require('gulp-standard');
var gutil       = require('gulp-util');
var plumber     = require('gulp-plumber');
// var nodeInspector = require('gulp-node-inspector');

const BROWSER_SYNC_RELOAD_DELAY = 500;
const MAIN_FILE = './app/app.js';

// error function for plumber
var onError = function (err) {
  gutil.beep();
  // console.log(err);
  this.emit('end');
};

gulp.task('nodemon', function (cb) {
  var called = false;
  return nodemon({
    script: MAIN_FILE,
    watch: [MAIN_FILE]
  })
    .on('start', function onStart() {
      // ensure start only got called once
      if (!called) { cb(); }
      called = true;
    })
    .on('restart', function onRestart() {
      setTimeout(function reload() {
        browserSync.reload({
          stream: false
        });
      }, BROWSER_SYNC_RELOAD_DELAY);
    });
});

gulp.task('browser-sync', ['nodemon'], function () {
  //Options: http://www.browsersync.io/docs/options/
  browserSync({
    proxy: 'http://localhost:3000',
    port: 4000,
    open: false
  });
});


gulp.task('bs-reload', function () {
  browserSync.reload();
});

// Lint JS task
gulp.task('jslint', function() {
  return gulp.src(['app/**/*.js','!fb_expale.js'])
    .pipe(plumber({ errorHandler: onError }))
    .pipe(standard())
    .pipe(standard.reporter('default', {
      // breakOnError: true,
      quiet: true
    }))
});

// gulp.task('debug', function() {
//   return gulp.src([])
//     .pipe(nodeInspector({
//       debugPort: 3000,
//       webHost: '0.0.0.0',
//       webPort: 8080,
//       saveLiveEdit: false,
//       preload: true,
//       inject: true,
//       hidden: [],
//       stackTraceLimit: 50,
//       sslKey: '',
//       sslCert: ''
//     }));
// });

gulp.task('default', ['jslint', 'browser-sync'], function () {
  gulp.watch(['app/**/*.js','!fb_expale.js'], ['jslint', browserSync.reload]);
	// gulp.watch('app/**/*.pug', [browserSync.reload]);
  // gulp.watch('public/**/*.js',   ['js', browserSync.reload]);
  // gulp.watch('public/**/*.css',  ['css']);
  // gulp.watch('public/**/*.html', ['bs-reload']);
});
