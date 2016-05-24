// drew runtime

(function(exports){
  var compileDrew = typeof Drew === 'object' ? Drew.compileDrew : require('./compile').compileDrew;
  var logging = typeof Drew === 'object' ? Drew.logging : require('./logging').logging;

  var LOG = logging.LOG;
  var DESC = logging.DESC;
  var WARN = logging.WARN;
  var MED = logging.MED;
  var HI = logging.HI;
  var GROPEN = logging.GROPEN;
  var GRCLOSE = logging.GRCLOSE;

  // BODY-START

  function runDrew(func, tokens, macros, constants, callback, repeatMode, returnIndexOnly) {
    var pointer = 0;
    var rinseStart = 0;
    var count = tokens.length;

    var paramStack = [];
    // lazily compile macros on demand
    var macroCache = {};

    return rinse(func);

    function rinse(func) {
      var start = 0;
      do {
        GROPEN('rinse', pointer, repeatMode, returnIndexOnly);
        MED('Applying query at pointer=', pointer, 'start=', start, 'count=', count);
        rinseStart = pointer;
        paramStack.length = 0;
        while (start < count && !run(func)) {
          pointer = ++start;
          MED('Applying query at', pointer);
          rinseStart = pointer;
          paramStack.length = 0;
        }
        if (start < count) {
          foundMatch(start);

          switch (repeatMode) {
            case 'once':
              MED('- repeat mode is "once", so stopping now');
              GRCLOSE(); // rinse
              return;
            case 'every':
              MED('- repeat mode is "every", so applying query at last start + 1');
              break; // pointer becomes start + 1 after loop
            case 'after':
              MED('- repeat mode is "after", so applying query immediately after end of last match');
              start = pointer; // repeat search with the first token after the last one of current match
              break;
            default:
              THROW('UNKNOWN_REPEAT_MODE');
          }
          GRCLOSE(); // rinse
        } else {
          GRCLOSE(); // rinse
          break; // OOB
        }
      } while (true);
    }

    function foundMatch(start) {
      HI('- rinse match from '+start+' to '+pointer);
      LOG('-- unwinding param stack:', paramStack);
      var params = {};
      if (!paramStack.length) {
        paramStack.push(
          0, start,
          1, Math.max(start, pointer-1)
        );
      }

      var max = 0;
      for (var i = 0; i < paramStack.length; i += 2) {
        var key = paramStack[i];
        var tokenIndex = paramStack[i + 1];
        params[key] = returnIndexOnly ? tokenIndex : tokens[tokenIndex];
        if (key > max) max = parseInt(key, 10);
      }

      var keys = Object.keys(params);
      var objMode = (keys.some(function (key) {
        return String(parseInt(key, 10)) !== key;
      }));

      if (objMode) {
        HI('-- params passed on to callback:', params);
        LOG('-- as object in first arg');
        callback(params);
      } else {
        params.length = max + 1; // no need to convert to actual array for .apply
        HI('-- params passed on to callback:', params);
        LOG('-- as array applied to args');
        callback.apply(undefined, params);
      }
    }

    function THROW(m) {
      throw new Error(m);
    }

    function run(func) {
      return func(and, or, then, macro, token, prev, next, seek, arrow, not, current, value, seekTo, caret, dollar, DESC);
    }

    /**
     * Returns tokens[pointer]
     *
     * @returns {Object}
     */
    function current() {
      return tokens[pointer];
    }

    /**
     * Return the value of the current() token
     *
     * @returns {string}
     */
    function value() {
      return current().value;
    }

    /**
     * Set pointer to absolute index. No OOB checks.
     *
     * @param {number} index
     * @returns {boolean} Always true
     */
    function seekTo(index) {
      LOG('moving pointer from '+pointer+' to '+index);
      pointer = index;
      LOG('- new current():', current());
      return true; // never fails. or should it?
    }

    /**
     * Returns whether the "current" token is a black token. This
     * is language dependent, driven by a macro. White tokens are
     * not universal so a custom macro is required.
     *
     * @returns {boolean}
     */
    function _isBlack() {
      var start = pointer;
      var b = !!macro('IS_BLACK');
      LOG('_isBlack() == ', b);
      pointer = start;
      return b;
    }

    function _seekToBlack() {
      GROPEN('seeking to next black... pointer: ' + pointer, 'rinseStart=', rinseStart + ', current:', current());
      var bstart = pointer;

      while (true) {
        var pass = false;

        if (pointer >= count) {
          LOG('EOF without finding black token');
          break;
        }

        if (_isBlack()) {
          pass = true;
          LOG('Found black token');
          break;
        }

        if (pointer === rinseStart) {
          LOG('Not seeking at start of a query');
          pass = false;
          break;
        }

        ++pointer;
        LOG('trying next: pointer: ' + pointer + ', token:', current());
      }

      if (pass) {
        LOG('now at black. pointer: ' + pointer + ', current:', current());
      } else {
        // reset pointer if the seek failed
        pointer = bstart;
        LOG('NOT at black because the seek failed. pointer: ' + pointer + ', current:', current());
      }

      GRCLOSE();
      return pass;
    }

    /**
     * Returns whether the current token is a newline token. This
     * is language dependent, driven by a macro. While certain
     * characters are de facto standard newlines, some are only
     * considered newlines by certain languages.
     *
     * @returns {boolean}
     */
    function _isNewline() {
      return !!macro('IS_NEWLINE');
    }

    /**
     * Both functions are called with pointer
     * at the current token (so pointer is reset
     * after calling f1 and before calling f2,
     * this is the difference with `then`) and
     * they must both return true.
     * If this function returns true, the pointer
     * may have been moved. Else the pointer is
     * always reset to its initial value when
     * calling this function.
     *
     * @param {Function} f1
     * @param {Function} f2
     * @param {string} [lcode]
     * @param {string} [rcode]
     * @returns {boolean}
     */
    function and(f1, f2, lcode, rcode) {
      GROPEN("%d %o and %o", pointer, lcode, rcode);
      var start = pointer;
      var paramStart = paramStack.length;
      if (f1()) {
        pointer = start;
        if (f2()) {
          GRCLOSE();
          return true;
        }
      }
      if (f1() && f2()) {
        GRCLOSE();
        return true;
      }
      pointer = start;
      paramStack.length = paramStart;
      GRCLOSE();
      return false;
    }

    /**
     * Returns true when either function returns
     * true with the pointer at the current start.
     * If true, the pointer may have been moved,
     * otherwise the pointer is reset to start.
     *
     * @param {string} [lcode]
     * @param {string} [rcode]
     * @param {Function} f1
     * @param {Function} f2
     * @returns {boolean}
     */
    function or(f1, f2, lcode, rcode) {
      GROPEN("%d %o or %o", pointer, lcode, rcode);
      var start = pointer;
      var paramStart = paramStack.length;
      if (f1()) {
        GRCLOSE();
        return true;
      }
      if (f2()) {
        GRCLOSE();
        return true;
      }
      pointer = start;
      paramStack.length = paramStart;
      GRCLOSE();
      return false;
    }

    /**
     * Returns true if first f1 and then f2 return
     * true when called. Pointer is not reset
     * between the calls (this is the difference to
     * `and`).
     * If returning true, the pointer may have been
     * changed. If false, the pointer is reset.
     *
     * @param {Function} f1
     * @param {Function} f2
     * @returns {boolean}
     */
    function then(f1, f2, lcode, rcode) {
      GROPEN("%d %o then %o", pointer, lcode, rcode);
      var start = pointer;
      var paramStart = paramStack.length;
      if (f1()) {
        if (f2()) {
          GRCLOSE();
          return true;
        }
      }
      pointer = start;
      paramStack.length = paramStart;
      GRCLOSE();
      return false;
    }

    /**
     * Run the macro :)
     *
     * @param {string} name
     * @returns {boolean}
     */
    function macro(name) {
      GROPEN('macro', name, pointer, 'current:', current());
      if (!macroCache[name]) {
        LOG('  On the fly compiling macro:', name);
        if (!macros[name] && !constants[name]) WARN('Missing macro:', name, 'This is probably a bug. Maybe an internal macro you still need to define for this language?');
        macroCache[name] = macros[name] ? compileDrew(macros[name], true, false, true) : compileDrew('return ' + constants[name], true, true);
        LOG('  Compiled result:', macroCache[name]);
      }
      var b = run(macroCache[name]);
      LOG('  macro '+name+' result:', b);
      if (typeof b !== 'boolean') debugger;
      GRCLOSE();
      return b;
    }

    /**
     * Try to match the current token
     *
     * @param {string} type
     * @param {Function} func This is the condition to match against the current token
     * @param {number} min
     * @param {number} max
     * @param {string} startDesig Empty string means no arg
     * @param {string} stopDesig Empty string means no arg
     * @returns {boolean}
     */
    function token(type, func, min, max, startDesig, stopDesig, desc) {
      if (type !== 'white' && type !== 'black' && type !== 'group') reject('if this fails update the group check below to match');
      GROPEN('token[%o , %o](%d, %d) type= %o pointer= %d rinseStart= %d desc= %o', (startDesig||'<unset>'), (stopDesig||'<unset>'), min, max, type, pointer, rinseStart, desc);
      var start = pointer;
      var paramStart = paramStack.length;
      var reportedStart = start; // may be moved forward if seeking to black // TODO: add test like `[foo]({A}|[B]|{C}|[D])` to check backtracking this reported value

      var matches = 0;
      var matched = true;
      var loopStart = pointer;
      var loopParamStart = paramStack.length;
      while (matched && pointer < count && (!max || matches < max)) {
        matched = false;
        LOG('pointer before:', pointer, 'token:', current());
        if (type === 'black') {
          var wasAtStart = pointer === start;
          LOG('seeking from start? %o', wasAtStart);
          _seekToBlack();
          if (wasAtStart) {
            LOG('Note: reporting token start at %d instead because white tokens were skipped', pointer);
            reportedStart = pointer;
          } // dont report skipped white tokens to designators
        }
        LOG('pointer after:', pointer, 'token:', current());
        if (pointer < count) {
          if (func()) {
            matched = true;
            if (type !== 'group') ++pointer;
            ++matches;
            loopStart = pointer;
            loopParamStart = paramStack.length;
          }
        }
      }
      // reset last loop fail
      pointer = loopStart;
      paramStack.length = loopParamStart;

      var ok = matches >= min && (matches <= max || !max);
      if (ok) {
        LOG('- assigning to designators (if set):', startDesig || '<unset>', '=', reportedStart, ',', stopDesig || '<unset>', '=', Math.max(reportedStart, pointer-1));
        if (startDesig !== '') paramStack.push(startDesig, reportedStart);
        if (stopDesig !== '') paramStack.push(stopDesig, Math.max(reportedStart, pointer-1));
      } else {
        pointer = start;
        paramStack.length = paramStart;
      }

      GRCLOSE();
      LOG(ok ? 'passed' : 'failed');
      return ok;
    }

    /**
     * Move the pointer one token back "unconditionally". Only "fails"
     * if pointer is already at the start or when searching for the
     * black and there is no previous black. Otherwise never fails.
     * Pointer only updated if it returns true.
     *
     * @param {boolean} toBlack One token or until the previous black token?
     * @param {number} min
     * @param {number} max
     * @param {string} startDesig
     * @param {string} stopDesig
     * @returns {boolean}
     */
    function prev(toBlack, min, max, startDesig, stopDesig, desc) {
      LOG('prev %o %b %d', toBlack, pointer, desc);
      var start = pointer;
      var paramStart = paramStack.length;

      var n = 0;
      while (_prev(toBlack) && (++n < max || !max));

      if (n >= min && (n <= max || !max)) {
        if (startDesig !== '') paramStack.push(startDesig, start);
        if (stopDesig !== '') paramStack.push(stopDesig, Math.max(start, pointer-1));
        return true;
      }

      pointer = start;
      paramStack.length = paramStart;
      return false;
    }

    /**
     * Go back one token. Optionally, go back until the first
     * encountered black token.
     * Resets pointer if returns false (if pointer ends up <0).
     *
     * @param {boolean} toBlack
     * @returns {boolean}
     */
    function _prev(toBlack) {
      if (pointer <= 0) return false;
      var start = pointer;
      var paramStart = paramStack.length;

      --pointer;
      if (toBlack) {
        while (pointer > 0 && !_isBlack()) {
          --pointer;
        }
        if (!_isBlack()) {
          pointer = start;
          paramStack.length = paramStart;
          return false;
        }
      }
      return true;
    }

    /**
     * Go forward one token, or until next black token.
     * Returns false if the pointer goes beyond EOF.
     * Resets pointer if false is returned.
     *
     * @param {boolean} toBlack
     * @param {number} min
     * @param {number} max
     * @param {string} startDesig
     * @param {string} stopDesig
     * @returns {boolean}
     */
    function next(toBlack, min, max, startDesig, stopDesig, desc) {
      LOG('next %o %b %d', pointer, toBlack, desc);
      var start = pointer;
      var paramStart = paramStack.length;

      var n = 0;
      while (_next(toBlack) && (++n < max || !max));

      if (n >= min && (n <= max || !max)) {
        if (startDesig !== '') paramStack.push(startDesig, start);
        if (stopDesig !== '') paramStack.push(stopDesig, Math.max(start, pointer-1));
        return true;
      }

      pointer = start;
      paramStack.length = paramStart;
      return false;
    }

    /**
     * Go forward one token. Optionally, go forward until the
     * first encountered black token.
     * Resets pointer if returns false (if pointer ends up
     * beyond EOF).
     *
     * @param {boolean} toBlack
     * @returns {boolean}
     */
    function _next(toBlack) {
      if (pointer <= 0) return false;
      var start = pointer;
      var paramStart = paramStack.length;

      ++pointer;

      if (toBlack) {
        if (!_seekToBlack()) {
          pointer = start;
          paramStack.length = paramStart;
          return false;
        }
      }

      if (pointer >= count) {
        pointer = start;
        paramStack.length = paramStart;
        return false;
      }

      return true;
    }

    /**
     * Skip tokens until the next token condition in the query matches.
     * This is a much more efficient version of doing `[*]*`
     * If seek() returns true, it will move the pointer beyond to
     * whatever the next token query part matched.
     * Quantifiers are meaningless and considered parse errors.
     * Designators cover the range skipped while seeking
     * TODO: confirm this is indeed more efficient. it may not matter.
     *
     * @param {Function} func Skip tokens until this returns true
     * @param {string} startDesig
     * @param {string} stopDesig
     * @returns {boolean} true if func returns true before EOF
     */
    function seek(func, startDesig, stopDesig, desc) {
      GROPEN('seek['+(startDesig||'<unset>')+','+(stopDesig||'<unset>')+'] %o %s', pointer, desc);

      if (pointer === rinseStart) {
        LOG('Not seeking at start of query');
        GRCLOSE(); // seek
        return false;
      }

      LOG('current():', current());
      var start = pointer;
      var paramStart = paramStack.length;

      var moved = 0;
      LOG('Testing condition from', pointer, 'token:', current());
      while (pointer < count && !func()) {
        LOG('Stranted at', pointer);
        pointer = ++moved + start;
        LOG('Condition not matching, moving to next pointer:', pointer, 'token:', current());
      }
      LOG('Ended at', pointer);

      if (pointer >= count) { // TODO: should it be > or >= here... is pointer===count a valid state?
        pointer = start;
        paramStack.length = paramStart;
        GRCLOSE(); // seek
        return false;
      }

      LOG('- assigning to designators (if set):', startDesig || '<unset>', '=', start, ',', stopDesig || '<unset>', '=', pointer);
      if (startDesig !== '') paramStack.push(startDesig, start);
      if (stopDesig !== '') paramStack.push(stopDesig, Math.max(start, pointer-1));

      GRCLOSE(); // seek
      return true;
    }

    /**
     * Basically [*][NEWLINE]<
     * In words; puts you at the first next newline (not after)
     * Quantifiers are meaningless and a parse error
     * Designators cover the range skipped while seeking
     *
     * @param {String} startDesig
     * @param {String} stopDesig
     * @returns {boolean}
     */
    function arrow(startDesig, stopDesig, desc) {
      GROPEN('arrow['+(startDesig||'<unset>')+','+(stopDesig||'<unset>')+'], %o %d', pointer, desc);

      if (pointer === rinseStart) {
        LOG('Not seeking at start of query');
        GRCLOSE(); // seek
        return false;
      }

      // seek until next newline token
      var start = pointer;
      var paramStart = paramStack.length;

      while (pointer && ++pointer < count && !_isNewline());

      if (pointer >= count) {
        pointer = start;
        paramStack.length = paramStart;
        GRCLOSE();
        return false;
      }

      if (startDesig !== '') paramStack.push(startDesig, start);
      if (stopDesig !== '') paramStack.push(stopDesig, Math.max(start, pointer-1));
      GRCLOSE();
      return true;
    }

    /**
     * Skip exactly one token if the next token-match fails. Will
     * only skip one token even if the match moved the pointer
     * more or less than that. Will reset the pointer if the match
     * succeeded.
     *
     * @param {Function} func
     * @returns {boolean}
     */
    function not(func, desc) {
      GROPEN('not %o %d', pointer, desc);
      var start = pointer;
      var paramStart = paramStack.length;

      // note: if func() returns false, this operator passes, only then we keep the new pointer.
      if (!func()) {
        GRCLOSE();
        return true;
      } else {
        pointer = start;
        paramStack.length = paramStart;

        GRCLOSE();
        return false;
      }
    }

    /**
     * Check whether at start of file or whether previous token is a newline.
     * Can optionally only check for start of file.
     *
     * @param {boolean} sofOnly
     * @returns {boolean}
     */
    function caret(sofOnly, desc) {
      GROPEN('caret(' + (sofOnly?'^^':'^') + ') %o %s', pointer, desc);

      if (pointer === 0) {
        LOG('At first token, caret passes');
        GRCLOSE();
        return true;
      }
      if (sofOnly) {
        LOG('Requires to be at first token but pointer = %d, caret fails', pointer);
        GRCLOSE();
        return false;
      }

      --pointer;
      var b = _isNewline();
      ++pointer;

      if (b) LOG('Previous token is a newline, caret passes');
      else LOG('Previous token is NOT a newline, caret fails');
      GRCLOSE();
      return b;
    }

    /**
     * Check whether at end of file or whether next token is a newline.
     * Can optionally only check for end of file.
     *
     * @param {boolean} eofOnly
     * @returns {boolean}
     */
    function dollar(eofOnly, desc) {
      GROPEN('dollar(' + (eofOnly?'^^':'^') + ') %o %s', pointer, desc);

      if (pointer === count) {
        LOG('After last token, dollar passes');
        GRCLOSE();
        return true;
      }
      if (eofOnly) {
        LOG('Requires to be after last token but pointer = %d, dollar fails', pointer);
        GRCLOSE();
        return false;
      }

      var b = _isNewline();

      if (b) LOG('Current token is a newline, dollar passes');
      else LOG('Current token is NOT a newline, dollar fails');
      GRCLOSE();
      return b;
    }
  }

  // BODY-STOP

  exports.runDrew = runDrew;
})(typeof module === 'object' ? module.exports : window.Drew);
