var MapReduce = require('map-reduce')
var through  = require('through')
var from     = require('from')
var join     = require('relational-join-stream')
var LiveStream = require('level-live-stream')

function toFunction (f) {
  if('string' == typeof f)
    return function (e) {
      return e[f]
    }
  return f
}

module.exports = function (db, indexDb, map, stub) {

  if('string' === typeof indexDb)
    indexDb = db.sublevel(indexDb)

  var methods = indexDb.methods = indexDb.methods || {}

  methods.query = {type: 'readable'}
  methods.createQueryStream = {type: 'readable'}

  map = map || function (key, value, emit) {
    emit(value.toString())
  }

  stub = stub || function (value, query) {
    query = query.map(function (e) {
      return e.replace('~', '')
    })
    var header = null
    var matches = value.split('\n').map(function (line) {
      var ch = false

      for(var i in query) {
        var q = query[i]
        if(~line.indexOf(q)) {
          line = line.split(' '+q).join(' <strong>' + q + '</strong>'), ch = true
        }
      }
      return ch ? line : null
    }).filter(function (e) {return !!e}).join('\n')

    return matches
  }

  var insensitive = true
  var splitter = /[\W\d]+/

  function toCase(w) {
    return insensitive ? w.toUpperCase() : w
  }

  //I just realized that is is super dumb.
  //instead of merging all the results for a thing
  //into one object -- when it could just be a range
  //... which would make it work MUCH BETTER for realtime.

  //the dumb thing I was doing was reducing everything.
  //this is fine without reduce -- will have to test it on a large dataset though.

  //users are not gonna query many keys an once -- maybe two or three.
  //highly common terms could be handled differently, instead of indexing them,
  //just check the documents for them as they match other keys.
  //then, when you generate the stubs -- that is also when you could rank for word order
  //and the matching terms, etc.

  MapReduce(db, indexDb, function (key, val, emit) {

    function split (ary, rank) {
      if(!ary) return
      if('string' == typeof ary)
        ary = ary.split(splitter).filter(function (e) {
          return !!e
        })

      //allow an object of {word: rank}
      if('object' === typeof ary && !ary.forEach) {
        for(var w in ary) {
          if('number' === typeof ary[w] && !isNaN(ary[w])) {
            var o = {}
            o[key] = ary[w]
            emit([toCase(w), ary[w]].join('!'), key)
          }
        }
      }
      else {
      //add a bunch of words, apply rank of 1 or passed rank
        ary.forEach(function (w) {
          var o = {}
          o[key] = rank || 1
          emit([toCase(w), rank || 1].join('!'), key)
        })
      }
    }
    map(key, val, split)
  })

  indexDb.query = function (query, opts) {
    opts = opts || {}
    //default to false
    opts.tail = opts.tail !== false
    return join(query.map(function (k) {
      //create streams for each query
      k = k.toUpperCase()
      var range = /~$/.test(k)
        ? {start: '2!'+k.replace(/~$/, ''), end: '2!'+k}
        : {start: '2!'+k+'!', end: '2!'+k+'!~'}
      return LiveStream(indexDb, range)
    }), 'value',
    function (data) {
      //map to {word: rank}
      var a = data.key.split('!')
      var key = a[1].toLowerCase()
      var rank = Number(a[2])
      var o = {}
      o[key] = rank
      return o
    }, 
    function (e, k) {
      //merge ranks together
      return {
        key: k,
        value: e.reduce(function (acc, item) {
          for (var k in item)
            acc[k] = (acc[k] || 0) + Number(item[k])
          return acc
        }, {})
      }
    })
  }

  indexDb.createQueryStream = function (query, opts) {
    var n = 0, ended = false
    var seen = {}
    return indexDb.query(query, opts)
      .pipe(through(function (data) {
        if(seen[data.key]) return
        seen[data.key] = true
        n ++
        var self = this
        db.get(data.key, function (err, value) {
          if(!value) return
          var ret = stub(value, query, data.value)
          if(ret)
            self.queue({key: data.key, value: ret})
          if(!--n && ended) {
            self.queue(null)
          }
        })
      }, function () {
        ended = true
        if(n > 0) return
        this.queue(null)
      }))
  }

  return indexDb
}
