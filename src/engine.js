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
      var ast = this._parser.parse(query);
      console.log(ast);
    }
  };

  // Exporting
  global.SQLEngine = SQLEngine;
})(this);