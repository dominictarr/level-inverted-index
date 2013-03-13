# level-inverted-index

Inverted Index for levelup.

## Example

With prewired defaults!

``` js

var indexDb = InvertedIndex(db, 'index')

//get list of documents containing 'search' and 'term'
indexDb.query(['search', 'term'], function (err, docs){
  console.log(docs)
})

//stream stubs of documents
indexDb.createQueryStream(['search', 'term'])
  .on('data', console.log)
```

Configurable!

``` js

var indexDb = InvertedIndex(db, 'index',

  //extract words from documents

  function map(key, value, index) {
    //parse, and pull out any bits of text you want,
    //call index with an index and a rank!

    //here we split by anything that is not a letter
    //or a number
    index(value.split(/[^\w\d]+/))
  }, 

  //when quering with createQueryStream,
  //stub converts from each doc, to a short preview.
  //Possibly, highlighting matches with the query!
  function stub(doc, query) {
    return doc.substring(0, 140) + '...\n'
  })

```

insert documents into the database like you normally would.

``` js
fs.readFile('readme.md', function (err, value) {
  db.put('readme.md', value, function () {
    //and so on!
  })
})

//run an index batch
indexDb.start()
```

## TODO

add realtime update to `level-map-merge` and get them in `level-inverted-index` for free.

https://github.com/dominictarr/level-map-merge/blob/master/index.js#L106-L109


## License

MIT
