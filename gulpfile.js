'use strict';

// load plugins ====================
var gulp = require('gulp');
var $ = require('gulp-load-plugins')({
  pattern: [
    'gulp-*',
    'browser-sync',
    'run-sequence'
  ]
});

$.yargs = require('yargs').argv;
$.through = require('through2');
// $.yaml = require('js-yaml'); // yaml使わなくなったからあとで消す
$.fs = require('fs');
$._ = require('lodash');

// var blogConf = $.yaml.safeLoad($.fs.readFileSync('blog-conf.yml', 'utf8'));
var blogConf = $.fs.readFileSync('./blog-conf.json', 'utf8');

// config
var config = {
  src: './src/',
  dist: './htdocs/',
  browserSupport: ['last 3 versions', 'ie >= 8'],
  proxy: 'localhost:7002'
};

var createArchivesJson = function(postsObj) {
  // var json = JSON.parse($.fs.readFileSync(config.src + 'json/posts.json', 'utf8'));
  // var json = posts;
  var cache = {};
  var tags = [];

  // ソートするためのキーを追加しつつ必要なデータだけ抽出
  $._.forEach(postsObj, function(post, i){
    // 記事の日付を連続した数値に変換
    var sort_val = post.page_datetime.split('-').join('').split('T').join('').split(':').join('');
    cache[post.page_id] = {
      sort_key: sort_val,
      page_datetime: post.page_datetime,
      page_id: post.page_id,
      page_title: post.page_title,
      page_tag: post.page_tag,
      page_title: post.page_title
    }
  });

  // 日付でに降順ソート
  cache = $._.sortByAll(cache, cache.sort_key, function(val){return -val});

  $._.forEach(cache, function(post, i){
    delete post.sort_key;
    tags.push(post);
  });

  $.fs.writeFile(config.src + 'json/artchives.json', JSON.stringify(tags));
}


// 記事作成タスク ====================

// 各種ブログオブジェクト作成（*.md -> posts.json）
gulp.task('build:json', function(cb) {
  return gulp.src(config.src + 'post/**/*.md')
    .pipe($.util.buffer())
    .pipe($.markdownToJson('posts.json'))
    .pipe($.through.obj(function (file, enc, cb) {
      //バッファから文字列に変化させてJSONに戻す
      var postsObj = JSON.parse(String(file.contents));

      //デフォルトの設定を継承させる
      // postsObj = $._.assign({}, blogConf, postsObj);

      // バッファに戻す
      // file.contents = new Buffer(JSON.stringify(postsObj));

      createArchivesJson(postsObj);
    }))
    .pipe(gulp.dest(config.src + 'json/'))
});

// 全記事作成（post_id.md -> post_id.html）
gulp.task('build:post', function() {
  return gulp.src(config.src + 'post/**/*.md')
    .pipe($.frontMatter())
    .pipe($.markdown())
    .pipe($.layout(function(file) {
      var data = $._.assign({}, blogConf, file.frontMatter);
      return data;
    }))
    .pipe($.htmlPrettify({indent_char: ' ', indent_size: 2}))
    .pipe(gulp.dest(config.dist + 'archives/'));
});


// サイト開発タスク ====================

// server & browser sync
gulp.task('server', function() {
  $.browserSync({
    baseDir: config.dist,
    proxy: config.proxy
  });
});

// jade
gulp.task('jade', function () {
  gulp.src([config.src + 'jade/**/*.jade', '!' + config.src + 'jade/**/_*.jade'])
    .pipe($.plumber())
    .pipe($.data(function(file) {
      // console.log($.frontMatter(String(file.contents)))
      return require('./blog-conf.json');
    }))
    .pipe($.jade({
      pretty: true
    }))
    .pipe(gulp.dest(config.dist))
});

// imagemin:img
gulp.task('imagemin:img', function() {
  return gulp.src(config.src + 'img/**/*')
    .pipe($.plumber())
    .pipe($.imagemin())
    .pipe(gulp.dest(config.dist + 'img'))
    .pipe($.browserSync.stream());
});

// imagemin:svg
gulp.task('imagemin:svg', function() {
  return gulp.src(config.src + 'svg/**/*')
    .pipe($.plumber())
    .pipe($.imagemin())
    .pipe(gulp.dest(config.dist + 'img'))
    .pipe($.browserSync.stream());
});

// sass
gulp.task('sass', function() {
  return gulp.src(config.src + 'scss/style.scss')
    .pipe($.plumber())
    .pipe($.sourcemaps.init())
    .pipe($.sass().on('error', $.sass.logError))
    .pipe($.autoprefixer({
      browsers: config.browserSupport
    }))
    .pipe($.sourcemaps.write('./'))
    .pipe(gulp.dest(config.dist + 'css'))
    .pipe($.browserSync.stream());
});

// copy:font
gulp.task('copy:font', function() {
  return gulp.src(config.src + 'font/**/*')
    .pipe($.plumber())
    .pipe(gulp.dest(config.dist + 'font'))
    .pipe($.browserSync.stream());
});

// copy:misc
gulp.task('copy:misc', function() {
  return gulp.src(config.src + 'misc/**/*')
    .pipe($.plumber())
    .pipe(gulp.dest(config.dist + 'misc'))
    .pipe($.browserSync.stream());
});

// watch
gulp.task('watch', function() {
  $.watch([config.src + 'jade/**/*.jade'], function(e) {
    gulp.start(['jade']);
  });

  $.watch([config.src + 'scss/**/*.scss'], function(e) {
    gulp.start(['sass']);
  });
});

// build
// - only compile
gulp.task('build', function() {
  $.runSequence('jade', 'sass', 'imagemin:img', 'imagemin:svg', 'copy:font', 'copy:misc');
});

// default
//  - local development task
gulp.task('default', function() {
  $.runSequence(['build'], ['server'], ['watch']);
});
