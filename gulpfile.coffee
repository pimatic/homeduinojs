gulp = require('gulp')
watch = require('gulp-watch')
plumber = require('gulp-plumber')
coffee = require('gulp-coffee')

gulp.task('default', ->
  watch('src/**/*.coffee', verbose: true)
    .pipe(plumber()) # This will keep pipes working after error event
    .pipe(coffee(bare: yes))
    .pipe(gulp.dest('lib'))
)

gulp.task('build', ->
  gulp.src('src/**/*.coffee')
  .pipe(plumber()) # This will keep pipes working after error event
  .pipe(coffee(bare: yes))
  .pipe(gulp.dest('lib'))
)