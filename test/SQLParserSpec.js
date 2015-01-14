describe('SQLParser', function () {
  var parser;

  beforeEach(function () {
    parser = new SQLParser();
  });

  it('parses white spaces', function () {
    expect(parser.parse.ws.exec(' ', 0).res).toEqual(' ');
    expect(parser.parse.ws.exec('  ', 0).res).toEqual('  ');
  });

  it('parses strings', function () {
    expect(parser.parse.str.exec('"Daniel Craig" not a sting', 0).res).toEqual("Daniel Craig");
    expect(parser.parse.str.exec("'Daniel Craig' not a sting", 0).res).toEqual("Daniel Craig");
    expect(parser.parse.str.exec("'Daniel Craig not a sting", 0)).toBeUndefined();
    expect(parser.parse.str.exec('"Daniel \'Craig\'" not a sting', 0).res).toEqual("Daniel 'Craig'");
    expect(parser.parse.str.exec('\"Daniel\"', 0).res).toEqual("Daniel");
  });

  it('parses numbers', function () {
    expect(parser.parse.num.exec('100 ').res).toEqual(100);
    expect(parser.parse.num.exec('100.5400 ').res).toEqual(100.54);
    expect(parser.parse.num.exec('-100.5400 ').res).toEqual(-100.54);
  });

  it('parses table\'s name', function () {
    var query = 'users.name';
    expect(parser.parse.tc.exec(query, 0).res).toEqual({
      table: 'users',
      column: 'name'
    });
  });

  it('parses a list of table\'s name', function () {
    expect(parser.parse.listOfFields.exec('movie.name, actor.name', 0).res).toEqual([
      {
        table: 'movie',
        column: 'name'
      },
      {
        table: 'actor',
        column: 'name'
      }
    ]);
    expect(parser.parse.listOfFields.exec('*', 0).res).toEqual('*');
  });

  it('parses SELECT expression', function () {
    var query = 'SELECT movie.name, actor.name  FROM movie ';
    var res = parser.parse.SELECT_EXP.exec(query, 0);

    expect(res).toBeDefined();

    expect(res.res).toEqual({
      select: {
        fields: [
          {
            table: 'movie',
            column: 'name'
          },
          {
            table: 'actor',
            column: 'name'
          }
        ],
        from: 'movie'
      }
    });
  });

  it('parses JOIN expression', function () {
    var query = 'JOIN actor_to_movie ON actor_to_movie.movieID = movie.id ';
    var res = parser.parse.JOIN_EXP.exec(query, 0);

    expect(res).toBeDefined();

    expect(res.res).toEqual({
      join: {
        fields: [
          {
            table: 'actor_to_movie',
            column: 'movieID'
          },
          {
            table: 'movie',
            column: 'id'
          }
        ],
        table: 'actor_to_movie'
      }
    });
  });

  it('parses any values like string, number or table.column', function () {
    expect(parser.parse.val.exec('actor.name').res).toEqual({
      table: 'actor',
      column: 'name'
    });
    expect(parser.parse.val.exec('250.6').res).toEqual(250.6);
    expect(parser.parse.val.exec('"hello world!"').res).toEqual('hello world!');
  });

  it('parses comparing expression', function () {
    expect(parser.parse.COMP_EXP.exec('actor.name <>\'Daniel Craig\'').res).toEqual({
      left: {
        table: 'actor',
        column: 'name'
      },
      right: 'Daniel Craig',
      type: '<>'
    });

  });

  it('parses WHERE expression', function () {
    expect(parser.parse.WHERE_EXP.exec('WHERE actor.name <> \'Daniel Craig\'').res).toEqual({
      where: {
        left: {
          table: 'actor',
          column: 'name'
        },
        right: 'Daniel Craig',
        type: '<>'
      }
    });

    expect(parser.parse.WHERE_EXP.exec('WHERE actor.name<>-100.5').res).toEqual({
      where: {
        left: {
          table: 'actor',
          column: 'name'
        },
        right: -100.5,
        type: '<>'
      }
    });

    expect(parser.parse.WHERE_EXP.exec('WHERE very_long_complex_table_name1023.is_gay = true').res).toEqual({
      where: {
        left: {
          table: 'very_long_complex_table_name1023',
          column: 'is_gay'
        },
        right: true,
        type: '='
      }
    });

    expect(parser.parse.WHERE_EXP.exec('WHERE  null  = users.name').res).toEqual({
      where: {
        left: null,
        right: {
          table: 'users',
          column: 'name'
        },
        type: '='
      }
    });
  });

  it('could parse only SELECT expression', function () {
    var query  = 'SELECT movie.name, actor.name '
      +'FROM movie ';

    var res = parser.parse(query);
    expect(res).toEqual({
      select: {
        fields: [
          {
            table: 'movie',
            column: 'name'
          },
          {
            table: 'actor',
            column: 'name'
          }
        ],
        from: 'movie'
      }
    });
  });

  it('parser complex sql query', function () {
    var query = 'SELECT movie.name, actor.name '
      +'FROM movie '
      +'JOIN actor_to_movie ON actor_to_movie.movieID = movie.id '
      +'JOIN actor ON actor_to_movie.actorID = actor.id '
      +'WHERE actor.name <> \'Daniel Craig\'';

    var res = parser.parse(query);

    //console.log(JSON.stringify(res, 2, '\t'));

    expect(res).toBeDefined();

    expect(res).toEqual({
      select: {
        fields: [
          {
            table: 'movie',
            column: 'name'
          },
          {
            table: 'actor',
            column: 'name'
          }
        ],
        from: 'movie'
      },
      join: [
        {
          fields: [
            {
              table: 'actor_to_movie',
              column: 'movieID'
            },
            {
              table: 'movie',
              column: 'id'
            }
          ],
          table: 'actor_to_movie'
        },
        {
          fields: [
            {
              table: 'actor_to_movie',
              column: 'actorID'
            },
            {
              table: 'actor',
              column: 'id'
            }
          ],
          table: 'actor'
        }
      ],
      where: {
        left: {
          table: 'actor',
          column: 'name'
        },
        right: 'Daniel Craig',
        type: '<>'
      }
    });
  });
});