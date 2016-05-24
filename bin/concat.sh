#!/usr/bin/env bash

REX="// BODY-START(.*?)// BODY-STOP"

FILE="src/compile.js"
if [[ `cat $FILE` =~ $REX ]]
then
  COMPILE="${BASH_REMATCH[1]}"
else
  echo "Missing body macros in $FILE"
  exit 1
fi

FILE="src/drew.js"
if [[ `cat $FILE` =~ $REX ]]
then
  DREW="${BASH_REMATCH[1]}"
else
  echo "Missing body macros in $FILE"
  exit 1
fi

FILE="src/logging.js"
if [[ `cat $FILE` =~ $REX ]]
then
  LOGGING="${BASH_REMATCH[1]}"
else
  echo "Missing body macros in $FILE"
  exit 1
fi

FILE="src/runtime.js"
if [[ `cat $FILE` =~ $REX ]]
then
  RUNTIME="${BASH_REMATCH[1]}"
else
  echo "Missing body macros in $FILE"
  exit 1
fi

mkdir dist > /dev/null 2>&1

echo "
var Drew = (function(){

// compile.js
$COMPILE

// drew.js
$DREW

// logging.js
$LOGGING

// runtime.js
$RUNTIME


  return {
    compileDrew: compileDrew,
    drew: drew,
    logging: logging,
  };
})();

if (typeof module === 'object') module.exports = Drew;

" > dist/drew-dist.js

echo "Written concatted build to `pwd`/dist/drew-dist.js"
