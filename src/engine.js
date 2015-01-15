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