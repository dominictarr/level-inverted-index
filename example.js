
//run the example from level-couch-sync to get this db
var opts   = require('optimist').argv
var rimraf = require('rimraf')

if(opts.clean)
  rimraf.sync('/tmp/level-inverted-index-example')

var db = 
  require('level-sublevel')
    (require('levelup')
      ('/tmp/level-inverted-index-example'))

var InvertedIndex = require('./')

var index = InvertedIndex(db, 'index') //use default map, and query

if(opts._.length && (opts.index || opts.init)) {
  //add all those files to the database.
  var fs = require('fs')
  opts._.forEach(function (filename) {
    fs.readFile(filename, 'utf-8', function (err, data) {
      if(err) throw err
      db.put(filename, data, function () {
        console.log('indexed:', filename)
      })
    })
  })
}

else if(opts.batch) {
  index.start()
  index.on('merge', function (data) {
    if(Math.random() < 0.001)
      console.log(data)
  })
}

else if (opts.query) {

  index.query(opts._)
    .on('data', console.log)

}
else {
  index.createQueryStream(opts._)
    .on('data', console.log)
}
