describe('Engine', function () {
  var db, engine;

  beforeEach(function () {


    db  = {
      movie: [
        { id: 1, name: 'Avatar', directorID: 1 },
        { id: 2, name: 'Titanic', directorID: 1 },
        { id: 3, name: 'Infamous', directorID: 2 },
        { id: 4, name: 'Skyfall', directorID: 3 },
        { id: 5, name: 'Aliens', directorID: 1 }
      ],
      actor: [
        { id: 1, name: 'Leonardo DiCaprio' },
        { id: 2, name: 'Sigourney Weaver' },
        { id: 3, name: 'Daniel Craig' },
      ],
      director: [
        { id: 1, name: 'James Cameron' },
        { id: 2, name: 'Douglas McGrath' },
        { id: 3, name: 'Sam Mendes' }
      ],
      actor_to_movie: [
        { movieID: 1, actorID: 2 },
        { movieID: 2, actorID: 1 },
        { movieID: 3, actorID: 2 },
        { movieID: 3, actorID: 3 },
        { movieID: 4, actorID: 3 },
        { movieID: 5, actorID: 2 },
      ]
    };

    engine = new SQLEngine(db);
  });

  it('should create a projection table for a single table', function () {
    var ast = {
      "select": {
        "fields": [
          {
            "table": "movie",
            "column": "name"
          }
        ],
        "from": "movie"
      },
      "where": {
        "left": {
          "table": "movie",
          "column": "directorID"
        },
        "right": 1,
        "type": "="
      }
    };

    var vt = engine._projection(ast.select.from);

    expect(vt).toEqual([
      { 'movie.id': 1, 'movie.name': 'Avatar', 'movie.directorID': 1 },
      { 'movie.id': 2, 'movie.name': 'Titanic', 'movie.directorID': 1 },
      { 'movie.id': 3, 'movie.name': 'Infamous', 'movie.directorID': 2 },
      { 'movie.id': 4, 'movie.name': 'Skyfall', 'movie.directorID': 3 },
      { 'movie.id': 5, 'movie.name': 'Aliens', 'movie.directorID': 1 }
    ]);
  });

  it('should apply filtering for the projection', function () {
    var filter = engine._filter({
      "left": {
        "table": "movie",
          "column": "directorID"
      },
      "right": 1,
        "type": "="
    });

    var vt = [
      { 'movie.id': 1, 'movie.name': 'Avatar', 'movie.directorID': 1 },
      { 'movie.id': 2, 'movie.name': 'Titanic', 'movie.directorID': 1 },
      { 'movie.id': 3, 'movie.name': 'Infamous', 'movie.directorID': 2 },
      { 'movie.id': 4, 'movie.name': 'Skyfall', 'movie.directorID': 3 },
      { 'movie.id': 5, 'movie.name': 'Aliens', 'movie.directorID': 1 }
    ];

    expect(filter(vt)).toEqual([
      { 'movie.id': 1, 'movie.name': 'Avatar', 'movie.directorID': 1 },
      { 'movie.id': 2, 'movie.name': 'Titanic', 'movie.directorID': 1 },
      { 'movie.id': 5, 'movie.name': 'Aliens', 'movie.directorID': 1 }
    ]);
  });
  
  it('should join 2 tables by specified condition', function () {
    var vt = [
      { 'movie.id': 1, 'movie.name': 'Avatar', 'movie.directorID': 1 },
      { 'movie.id': 2, 'movie.name': 'Titanic', 'movie.directorID': 1},
      { 'movie.id': 3, 'movie.name': 'Infamous', 'movie.directorID': 2},
      { 'movie.id': 4, 'movie.name': 'Skyfall', 'movie.directorID': 3},
      { 'movie.id': 5, 'movie.name': 'Aliens', 'movie.directorID': 1}
    ];

    var join = {
      fields: [
        {
          table: 'director',
          column: 'id'
        },
        {
          table: 'movie',
          column: 'directorID'
        }
      ],
      table: 'director'
    };
    var joined = engine._join(vt, join);
    //console.log(JSON.stringify(joined, 2, '\t'));
    expect(joined).toEqual([
      { 'movie.id': 1, 'movie.name': 'Avatar', 'movie.directorID': 1, "director.id": 1, "director.name": "James Cameron" },
      { 'movie.id': 2, 'movie.name': 'Titanic', 'movie.directorID': 1, "director.id": 1, "director.name": "James Cameron" },
      { 'movie.id': 3, 'movie.name': 'Infamous', 'movie.directorID': 2, "director.id": 2, "director.name": "Douglas McGrath"},
      { 'movie.id': 4, 'movie.name': 'Skyfall', 'movie.directorID': 3, "director.id": 3, "director.name": 'Sam Mendes' },
      { 'movie.id': 5, 'movie.name': 'Aliens', 'movie.directorID': 1, "director.id": 1, "director.name": "James Cameron" }
    ]);
  });

  it('should SELECT columns', function(){
    var actual = engine.execute('SELECT movie.name FROM movie');
    expect(actual).toEqual([
      {'movie.name':'Avatar'},
      {'movie.name':'Titanic'},
      {'movie.name':'Infamous'},
      {'movie.name':'Skyfall'},
      {'movie.name':'Aliens'}
    ]);
  });

  it('should apply WHERE', function(){
    var actual = engine.execute('SELECT movie.name FROM movie WHERE movie.directorID = 1');
    expect(actual).toEqual([
      {'movie.name':'Avatar'},
      {'movie.name':'Titanic'},
      {'movie.name':'Aliens'}
    ]);
  });


  it('should perform parent->child JOIN', function(){
    var actual = engine.execute('SELECT movie.name, director.name '
    +'FROM movie '
    +'JOIN director ON director.id = movie.directorID');

    var etalon = [
      {'movie.name':'Avatar','director.name':'James Cameron'},
      {'movie.name':'Titanic','director.name':'James Cameron'},
      {'movie.name':'Aliens','director.name':'James Cameron'},
      {'movie.name':'Infamous','director.name':'Douglas McGrath'},
      {'movie.name':'Skyfall','director.name':'Sam Mendes'}
    ];
    actual = sort(actual);
    etalon = sort(etalon);
    expect(actual).toEqual(etalon);
  });

  it('should perform child->parent JOIN ', function(){
    var actual = engine.execute('SELECT movie.name, director.name '
    +'FROM director '
    +'JOIN movie ON director.id = movie.directorID');

    var etalon = [{'movie.name':'Avatar','director.name':'James Cameron'},
      {'movie.name':'Titanic','director.name':'James Cameron'},
      {'movie.name':'Infamous','director.name':'Douglas McGrath'},
      {'movie.name':'Skyfall','director.name':'Sam Mendes'},
      {'movie.name':'Aliens','director.name':'James Cameron'}];

    actual = sort(actual);
    etalon = sort(etalon);
    expect(actual).toEqual(etalon);
  });

  it('should perform many-to-many JOIN and apply WHERE', function(){
    var actual = engine.execute('SELECT movie.name, actor.name '
    +'FROM movie '
    +'JOIN actor_to_movie ON actor_to_movie.movieID = movie.id '
    +'JOIN actor ON actor_to_movie.actorID = actor.id '
    +'WHERE actor.name <> \'Daniel Craig\'');

    var etalon = [
      {'movie.name':'Aliens','actor.name':'Sigourney Weaver'},
      {'movie.name':'Avatar','actor.name':'Sigourney Weaver'},
      {'movie.name':'Infamous','actor.name':'Sigourney Weaver'},
      {'movie.name':'Titanic','actor.name':'Leonardo DiCaprio'}
    ];

    actual = sort(actual);
    etalon = sort(etalon);

    expect(actual).toEqual(etalon);

  });

  function sort (arr) {
    return arr.sort(function (row1, row2) {
      return row1['movie.name'] > row2['movie.name'] ? 1: -1;
    });
  };
});