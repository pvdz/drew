var split = function(str){
  var WHITE = 0;
  var NEWLINE = 2;
  var BLACK = 1;

  var blackCounter = 0;
  return str.split('').map(function(s, whiteIndex){
    var type = BLACK;
    if (s === ' ') type = WHITE;
    else if (s === '\n' || s === '\r') type = NEWLINE;
    return {
      type: type,
      value: s,
      white: whiteIndex,
      black: type === BLACK ? ++blackCounter : -1,
    };
  });
};