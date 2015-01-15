(function (global) {
  "use strict";

  /**
   * @class
   * @description
   * Main pattern class.
   * @param {Function} [exec]
   * @constructor
   */
  var Pattern = function (exec) {
    this.exec = exec;
  };

  /**
   * @description
   * Might be used when result should be formatter or transformed in special way.
   * @param {Function} format Function-formatter which will be applied to result. Should return formatted result.
   * @returns {Pattern}
   */
  Pattern.prototype.then = function (format) {
    var exec = this.exec;

    return new Pattern (function (str, pos) {
      pos = pos || 0;

      var result = exec(str, pos);

      return result && {
          res: format(result.res),
          end: result.end
        };
    });
  };

  /**
   * List of patterns.
   * @type {object}}
   */
  var Patterns = {

    /**
     * Pattern which parse predefined string.
     * @param {string} [text]
     * @returns {Pattern}
     */
    txt: function (text) {
      return new Pattern(function (str, pos) {
        pos = pos || 0;
        if (str.substr(pos, text.length) === text) {
          return {
            res: text,
            end: pos + text.length
          };
        }
      });
    },

    /**
     * Pattern which parse regexp.
     * @param {RegExp} [regexp]
     * @returns {Pattern}
     */
    rgx: function (regexp) {
      return new Pattern(function (str, pos) {
        pos = pos || 0;
        var result = regexp.exec(str.slice(pos));

        if (result && result.index === 0) {
          return {
            res: result[0],
            end: pos + result[0].length
          };
        }
      });
    },

    /**
     * Makes pattern optional.
     * @param {Pattern} [pattern]
     * @returns {Pattern}
     */
    opt: function (pattern) {
      return new Pattern(function (str, pos) {
        var result = pattern.exec(str, pos);
        pos = pos || 0;

        if (!result) {
          return {
            res: void 0,
            end: pos
          };
        }
        return result;
      });
    },

    /**
     * Tries to exec at least one pattern.
     * @param {Pattern, [Pattern...]}
     * @returns {Pattern}
     */
    any: function () {
      var patterns = Array.prototype.slice.call(arguments, 0);

      return new Pattern(function (str, pos) {
        pos = pos || 0;

        for (var result, i = 0; i < patterns.length; i++) {
          result = patterns[i].exec(str, pos);
          if (result) {
            return result;
          }
        }
      });
    },

    /**
     * Execs patterns one by one and returns array of results.
     * @param {Pattern, [Pattern...]}
     * @returns {Pattern}
     */
    seq: function () {
      var patterns = Array.prototype.slice.call(arguments, 0);

      return new Pattern(function (str, pos) {
        pos = pos || 0;

        var i,
          r,
          end = pos,
          result = [];
        for (i = 0; i < patterns.length; i++) {
          r = patterns[i].exec(str, end);

          if (!r) {
            return;
          }
          result.push(r.res);
          end = r.end;
        }

        return {
          res: result,
          end: end
        };
      });
    },

    /**
     * Repeatable sequences like `abc, dfe, gfh`.
     * @param {Pattern} [pattern] array of result will be returned
     * @param {Pattern} [separator] this pattern will be ignored and won't be included into results
     * @returns {Pattern}
     */
    rep: function(pattern, separator) {
      var separated = !separator ?
        pattern :
        this.seq(separator, pattern).then(function (result) {
          return result[1];
        });

      return new Pattern(function (str, pos) {
        pos = pos || 0;

        var end = pos,
          r = pattern.exec(str, end),
          result = [];

        while(r && r.end > end) {
          result.push(r.res);
          end = r.end;
          r = separated.exec(str, end);
        }

        return result.length ?
          {
            res: result,
            end: end
          }:
          void 0;
      });
    }
  };
  // Exporting
  global.Parser = {
    Pattern: Pattern,
    patterns: Patterns
  };

})(this);
(function (global) {
  "use strict";

  /**
   * @name SQLParser
   * @description
   * @todo
   * @param {object} options
   * @constructor
   */
  var SQLParser = function (options) {
    this._options = options || {};
  };
  SQLParser.prototype = {
    constructor: SQLParser,
    /**
     * @name SQLParser#parse
     * @description
     * @todo
     */
    parse: (function () {
      var p = global.Parser.patterns;

      // White space.
      var ws = p.rgx(/\s+/);

      // Optional white space
      var wso = p.opt(ws);

      // Dot
      var dot = p.txt('.');

      // Comma
      var comma = p.txt(',');

      // String
      var str = p.rgx(/(["'])(.*)[^\\]\1/).then(function (res) {
        return res.substring(1, res.length - 1);
      });

      // Number
      var num = p.rgx(/[\d\.\-]+/).then(function (res) {
        return parseFloat(res);
      });

      // Boolean
      var bool = p.rgx(/TRUE|FALSE/i).then(function (res) {
        return Boolean(res);
      });

      // Null
      var nul = p.rgx(/null/i).then(function () {
        return null;
      });

      // Literal
      var table = p.rgx(/[a-z_]+[a-z0-9_]+/i);

      // Column
      var column = table;

      // Select
      var SELECT = p.rgx(/SELECT/i);

      // From
      var FROM = p.rgx(/FROM/i);

      // JOIN
      var JOIN = p.rgx(/JOIN/i);

      // ON
      var ON = p.rgx(/ON/i);

      // WHERE
      var WHERE = p.rgx(/WHERE/i);

      // Table column
      var tc = p.seq(table,
        dot,
        column
      ).then(function (res) {
        return {
          table: res[0],
          column: res[2]
        };
      });

      // List of fields
      var listOfFields = p.any(
        p.txt('*'),
        p.rep(
          tc,
          p.seq(
            wso,
            comma,
            wso
          )
        )
      );

      // Equality of fields
      var fieldEquality = p.seq(
        tc,
        wso,
        p.txt('='),
        wso,
        tc
      ).then(function (res) {
        return {
          left: res[0],
          right: res[4]
        };
      });

      // Sign of comparison
      var comparison = p.any(
        p.txt('<>'),
        p.txt('<='),
        p.txt('>='),
        p.txt('<'),
        p.txt('>'),
        p.txt('=')
      );

      // Comparison value
      var val =  p.any(
        str,
        num,
        bool,
        nul,
        tc
      );

      // Selection section
      var SELECT_EXP = p.seq(
        SELECT, ws,
        listOfFields, ws,
        FROM, ws,
        table, wso
      ).then(function (res) {
        return {
          select: {
            fields: res[2],
            from: res[6]
          }
        };
      });

      // Join section
      var JOIN_EXP = p.seq(
        JOIN, ws,
        table, ws,
        ON, ws,
        fieldEquality, wso
      ).then(function (res) {
        return {
          join: {
            fields: [res[6].left, res[6].right],
            table: res[2]
          }
        };
      });

      // Comparing expression
      var COMP_EXP = p.seq(
        val,
        wso, comparison, wso,
        val
      ).then(function (res) {
        return {
          left: res[0],
          right: res[4],
          type: res[2]
        };
      });


      // Where section
      var WHERE_EXP = p.seq(
        WHERE, ws,
        COMP_EXP, wso
      ).then(function (res) {
        return {
          where: res[2]
        };
      });

      // Complex query expression
      var QUERY_EXP = p.seq(
        SELECT_EXP, wso,
        p.opt(p.rep(JOIN_EXP, wso)),
        p.opt(WHERE_EXP), wso
      ).then(function (res) {
          var ast = {
            select: res[0].select
          };

          if (res[2]) {
            ast.join = res[2].map(function (joinSection) {
              return joinSection.join;
            });
          }

          if (res[3]) {
            ast.where = res[3].where;
          }

          return ast;
        });

      // Result parsing function
      var parseFn = function (text) {
        return QUERY_EXP.exec(text).res;
      };

      // A list of patterns.
      parseFn.ws = ws;
      parseFn.str = str;
      parseFn.num = num;
      parseFn.tc = tc;
      parseFn.val = val;
      parseFn.listOfFields = listOfFields;
      parseFn.SELECT_EXP = SELECT_EXP;
      parseFn.JOIN_EXP = JOIN_EXP;
      parseFn.WHERE_EXP = WHERE_EXP;
      parseFn.COMP_EXP = COMP_EXP;
      parseFn.QUERY_EXP = QUERY_EXP;

      return parseFn;
    })()
  };

  global.SQLParser = SQLParser;
})(this);
(function (global) {
  "use strict";

  /**
   * Extend function
   * @returns {*}
   */
  function extend () {
    var args = Array.prototype.slice.call(arguments, 0);

    if (!args.length) {
      throw new Error('Extend function has been called with empty args.');
    }
    if (args.length === 1) {
      return args[0];
    }

    return args.slice(1).reduce(function(memo, o) {
      for (var key in o) {
        if (o.hasOwnProperty(key)) {
          memo[key] = o[key];
        }
      }
      return memo;
    }, args[0]);
  }
  
  /**
   * @name SQLEngine
   * @description
   * @todo
   * @param {object} dataBase Database to work with
   * @param {object=} parser SQL parser
   * @constructor
   */
  var SQLEngine = function (dataBase, parser) {
    this.setDb(dataBase);
    this._parser = parser || (new global.SQLParser());
  };
  SQLEngine.prototype = {
    constructor: SQLEngine,

    /**
     * @name SQLEngine#setDb
     * @description
     * Setter for DataBase.
     * @param {object} dataBase Database to work with
     */
    setDb: function (dataBase) {
      this._db = dataBase || {};
    },

    /**
     * @name SQLEngine#execute
     * @param {string} query SQL-query
     */
    execute: function (query) {
      var ast, virtualTable, filtered, selected, joined;

      ast = this._parser.parse(query);

      if (!ast) {
        throw new Error('Invalid query');
      }

      virtualTable = this._projection(ast.select.from);
      joined = this._joinAll(ast.join)(virtualTable);
      filtered = this._filter(ast.where)(joined);
      selected = this._select(ast.select)(filtered);

      return selected;
    },

    /**
     * @name SQLEngine#getTable
     * @description
     * Gets a entire clone of a table by name.
     * @param {string} name Name of the table in db
     * @returns {array|boolean} Array that represents a table or `false` if such table hasn't been found
     */
    getTable: function (name) {
      return this._deepClone(this._db[name]) || false;
    },

    /**
     * @name SQLEngine#_projection
     * @description
     * @todo
     * @param {string} tableName Main table
     * @param {Object} join Join section of the AST
     * @returns {Array<object>} Modified table
     * @private
     */
    _projection: function (tableName) {
      var baseTable, self;

      self = this;

      baseTable = this.getTable(tableName);

      if (!baseTable) {
        throw new Error('Table ' + tableName + ' does not exist');
      }

      return baseTable.map(function (row) {
        return Object.keys(row).reduce(function (memo, key) {
          var absoluteKey = self._buildFieldName({
            table: tableName,
            column: key
          });

          memo[absoluteKey] = row[key];
          return memo;
        }, {});
      });
    },

    /**
     * @name SQLEngine#_join
     * @description
     * Joins to tables by specified condition.
     * @param {Array} leftTableProjection Modified version of the left table
     * @param {Object} scheme Fields to join and a table name.
     * @returns {Array} Joined table
     * @private
     */
    _join: function (leftTableProjection, scheme) {
      var joinLeftColumn, joinRightColumn, rightTableProjection, self;

      self = this;

      rightTableProjection = this._projection(scheme.table);

      // Detect which field is left and which is right
      if (scheme.table === scheme.fields[0].table) {
        joinLeftColumn = this._buildFieldName(scheme.fields[1]);
        joinRightColumn = this._buildFieldName(scheme.fields[0]);
      } else {
        joinLeftColumn = this._buildFieldName(scheme.fields[0]);
        joinRightColumn = this._buildFieldName(scheme.fields[1]);
      }

      return leftTableProjection.reduce(function (memo, row) {
        var joinValue, selection;

        joinValue = row[joinLeftColumn];

        selection = rightTableProjection.filter(function (row) {
          return row[joinRightColumn] === joinValue;
        });

        selection.forEach(function (selectionRow) {
          extend(selectionRow, row);
        });

        return memo.concat(self._deepClone(selection));
      }, []);
    },

    /**
     * @name SQLEngine#_join
     * @description
     * Joins to tables by specified condition.
     * @param {Object} joinConfig Config that specifies a list of tables and fields which shuold be joined
     * @returns {Array} Joined table
     * @private
     */
    _joinAll: function (joinConfig) {
      var self;

      self = this;

      return function (leftTableProjection) {
        if (!joinConfig) {
          return leftTableProjection;
        }

        var result = joinConfig.reduce(function (memo, shema) {
          return self._join(memo, shema);
        }, leftTableProjection);

        return result;
      };

    },

    /**
     * @name SQLEngine#_filter
     * @description
     * @todo
     * @param {Object} where WHERE section of a query
     * @returns {Function}
     * @private
     */
    _filter: function (where) {
      var left, right, self;

      // If there was no WHERE section then we need to return a function that returns
      // passed value.
      if (!where) {
        return function (data) {
          return data;
        };
      }

      // Otherwise we need to build an expression
      self = this;
      left = makeValueFn(where.left);
      right = makeValueFn(where.right);

      // @todo
      function makeValueFn (expressionOperand) {
        var field = null;

        if (!!expressionOperand.table) {
          field = self._buildFieldName(expressionOperand);
        }
        return function (row) {
          return field ?
            row[field] :
            expressionOperand;
        };
      }

      // The whole expression
      var expression = (function () {
        var compSign = {
          '<>': function (row) { return left(row) !== right(row); },
          '<=': function (row) { return left(row) <= right(row); },
          '>=': function (row) { return left(row) >= right(row); },
          '=': function (row) { return left(row) === right(row); },
          '<': function (row) { return left(row) < right(row); },
          '>': function (row) { return left(row) > right(row); }
        };

        return compSign[where.type];
      })();

      // Accepts a virtual table
      return function (data) {
        return data.filter(expression, this);
      };
    },

    /**
     * @name SQLEngine#_select
     * @description
     * @todo
     * @param {Object} select SELECT section of a query
     * @returns {Function}
     * @private
     */
    _select: function (select) {
      var fieldsNum, self;

      self = this;
      fieldsNum = select.fields.length;

      return function (data) {
        return data.map(function (row) {
          var resultRow, fieldName;

          resultRow = {};

          for (var i = 0; i < fieldsNum; i++) {
            fieldName = self._buildFieldName(select.fields[i]);
            resultRow[fieldName] = row[fieldName];
          }

          return resultRow;
        });
      };
    },

    /**
     * @name SQLEngine#_buildFieldName
     * @description
     * Builds full column name starting with table;
     * @param {object} field Field object
     * @returns {string} Compiled string in a way `tableName.columnName`
     * @private
     */
    _buildFieldName: function (field) {
      return [field.table, field.column].join('.');
    },

    /**
     * @name SQLEngine#_deepClone
     * @description
     * Makes a deep copy of the variable.
     * @param {*} o Variable to be cloned
     * @returns {*} The clone of specified variable
     * @private
     */
    _deepClone: function (o) {
      return JSON.parse(JSON.stringify(o));
    }
  };

  // Exporting
  global.SQLEngine = SQLEngine;
})(this);