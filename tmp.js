function rule(){
  // input rule: [SPACE]*[NUMBER]=0
  // final rule: [` `]*[NUMBER]=0
  // rule start..
  if (!(checkToken(symw() && value(' ')))) return false;

  // rule end..
  return true;
}



function rule(){
  // input rule: [SPACE]*[NUMBER]=0
  // final rule: [` `]*[NUMBER]=0
  // rule start..
  var min = 0;
  var max = 0;
  var n = 0;
  while (n <= min && (!max || n <= max)) {
    if (!(checkToken(symw() && value(' ')))) break;
    ++n;
  }
  if (n < min) return false;

  if (!(checkToken(symw() && type(NUMBER)))) return false;

  // rule end..
  return true;
}



// [foo|bar]*
