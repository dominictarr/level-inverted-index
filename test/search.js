
var nonsense = require('nonsense')
var levelup  = require('level')
var sublevel = require('level-sublevel')

var dir = '/tmp/test-inverted-index'
require('rimraf').sync(dir)

var db       = sublevel(levelup(dir))
var hash     = require('sha1sum')
var InvertedIndex
             = require('../')
var fs       = require('fs')
var path     = require('path')

var indexDb = InvertedIndex(db, 'index')

var test = require('tape')

test('string',function (t) {

  var r = nonsense.sentences(
    fs.createReadStream(path.join(__dirname, 'art-of-war.txt'))
  , 2)
  .on('end', function () {

    var int = 
    setInterval(function () {
      var line = r.random().join(' ')
      db.put(Date.now(), line, function (err) {
        if(err) throw err
      })
    }, 20)

    var n = 10
    indexDb.createQueryStream(['w*'], {tail: true})
    .on('data', function (d) {
     console.log(d)
      db.get(d.key, function (err, value) {
        t.ok(value.indexOf(' w'))
        if(--n) return
        clearInterval(int)
        t.equal(0, n)
        t.end()
      })
    })
  })
})

test('string', function (t) {

  var r = nonsense.sentences(
    fs.createReadStream(path.join(__dirname, 'art-of-war.txt'))
  , 2)
  .on('end', function () {

    var int = 
    setInterval(function () {
      var line = r.random().join(' ')
      db.put(Date.now(), line, function (err) {
        if(err) throw err
      })
    }, 20)

    var n = 10
    indexDb.createQueryStream('w*', {tail: true})
    .on('data', function (d) {
     console.log(d)
      db.get(d.key, function (err, value) {
        t.ok(value.indexOf(' w'))
        if(--n) return
        clearInterval(int)
        t.equal(n, 0)
        t.end()
      })
    })
  })
})


