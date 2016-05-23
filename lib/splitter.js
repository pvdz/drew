var split = function(str){
  // all Drew requires is an object with a .value property containing the value of that token
  // any additional meta data could be used in custom constants, though.
  return str.split('').map(function(s){
    return {
      value: s,
    };
  });
};

module.exports = split;
