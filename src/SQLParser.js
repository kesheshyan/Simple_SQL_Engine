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