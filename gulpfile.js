var gulp = require('gulp');
var concat = require('gulp-concat');

gulp.task('default', function() {
  gulp.src(['src/parser.js', 'src/**/*.js'])
    .pipe(concat('simlpleSQLEngine.js'))
    .pipe(gulp.dest('./dist/'));
});