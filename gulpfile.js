const gulp = require('gulp');
const htmlmin = require('gulp-htmlmin');
const terser = require('gulp-terser');
const cleanCSS = require('gulp-clean-css'); // 添加CSS压缩插件

function minifyHTML() {
  return gulp.src('source/**/*.html')
    .pipe(htmlmin({
        removeComments: true, //清除HTML注释
        collapseWhitespace: true, //压缩HTML
        collapseBooleanAttributes: true, //省略布尔属性的值 <input checked="true"/> ==> <input checked />
        removeEmptyAttributes: true, //删除所有空格作属性值 <input id="" /> ==> <input />
        removeScriptTypeAttributes: false, //删除<script>的type="text/javascript"
        removeStyleLinkTypeAttributes: false, //删除<style>和<link>的type="text/css"
        minifyJS: true, //压缩页面JS
        minifyCSS: true //压缩页面CSS
    }))
    .pipe(gulp.dest('public'));
}

function minifyJS() {
  return gulp.src('source/**/*.js')
    .pipe(terser())
    .pipe(gulp.dest('public'));
}

function minifyCSS() {
  return gulp.src('source/**/*.css')
    .pipe(cleanCSS())
    .pipe(gulp.dest('public'));
}

gulp.task('default', gulp.parallel(minifyHTML, minifyJS, minifyCSS));