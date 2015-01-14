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
      var str = p.rgx(/(["'])(.*?)\1/).then(function (res) {
        return res.substring(1, res.length - 1);
      });

      // Number
      var num = p.rgx(/[\d\.\-]+/).then(function (res) {
        return parseFloat(res);
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
      var listOfFields =  p.rep(
        tc,
        p.seq(
          wso,
          comma,
          wso
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
        p.rep(JOIN_EXP, wso),
        WHERE_EXP, wso
      );

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
/**
 * Created by ruslan.kesheshyan@gmail.com on 1/13/15.
 */
(function (global) {
  "use strict";

  /**
   * @name SQLEngine
   * @description
   * @todo
   * @param {object} dataBase Database to work with
   * @constructor
   */
  var SQLEngine = function (dataBase) {
    this.setDb(dataBase);
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
     * @name
     * @param query
     */
    execute: function (query) {
      
    }
  };

  // Exporting
  global.SQLEngine = SQLEngine;
})(this);