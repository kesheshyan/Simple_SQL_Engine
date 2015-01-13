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
        this.seq(separator, pattern).then(function (result) {return result[1]});

      return new Pattern(function (str, pos) {
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