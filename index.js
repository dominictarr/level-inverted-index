var MapMerge = require('level-map-merge')
var through  = require('through')
var from     = require('from')

module.exports = function (db, indexDb, map, stub) {

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
      if(line.trim() && !header)
        header = line

      for(var i in query) {
        var q = query[i]
        if(~line.indexOf(q)) {
          line = line.replace(q, '<strong>' + q + '</strong>'), ch = true
        }
      }
      return ch ? line : null
    }).filter(function (e) {return !!e}).join('\n')

    return header + '\n' + matches
  }

  var insensitive = true
  var splitter = /[\W\d]+/

  if('string' === typeof indexDb)
    indexDb = db.sublevel(indexDb)

  function toCase(w) {
    return insensitive ? w.toUpperCase() : w
  }

  MapMerge(db, indexDb, function (key, val, emit) {

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
            emit(toCase(w), o)
          }
        }
      }
      else {
      //add a bunch of words, apply rank of 1 or passed rank
        ary.forEach(function (w) {
          var o = {}
          o[key] = rank || 1
          emit(toCase(w), o)
        })
      }
    }
    map(key, val, split)
  },
  function (M, m, key) {

    for(var k in m) {
      if(!M[k]) M[k] = m[k]
      else      M[k] += m[k]
    }

    indexDb.emit('merge', k, M)

    return M
  })

  indexDb.query = function (query, cb) {

    var acc = null, n = 0
    //if(!Array.isArray(query)
    /*var query = process.argv.slice(2)*/

    query.filter(function (e) {
      return !!e
    }).map(function (e) {
        return e.toUpperCase()
    }).forEach(function (e) {
      n ++

      var k = e

      var group = {}
      //if the search term ends in ~
      //turn that into a range query - so you can search
      //for any word that starts with TERM~
      indexDb.createReadStream({
        start: k.replace(/~$/, ''), end: k
      })
      .pipe(through(function (data) {
        var key = data.key.replace(/^.*~/, '')
        group = or(group, JSON.parse(data.value), key.toLowerCase())
      }, function () {
        if(!acc) acc = group
        else acc = and(acc, group)
        if(--n) return
        cb(null, acc)
      }))
    })

    function or (acc, item, e) {
      for(var k in item) {
        if(acc[k]) acc[k].push([e, item[k]])
        else       acc[k] = [[e, item[k]]]
      }
      return acc
    }

    function and (acc, item) {
      var r = {}
      for(var k in acc)
        if(item[k]) r[k] = acc[k].concat(item[k])
      return r
    }
  }
  indexDb.createQueryStream = function (query) {
    var docs
    var rs = from(function (i, next) {
      var self = this
      if(i >= docs.length) return this.emit('end')
      db.get(docs[i], function (err, value) {
        if(value) self.emit('data', stub(value, query))
        next()
      })
    })
    rs.pause()
    indexDb.query(query, function (err, data) {
      docs = Object.keys(data)
      rs.resume()
    })

    return rs
  }

  return indexDb
}
