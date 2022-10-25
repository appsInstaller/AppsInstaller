 // single keys
 '4'
 "?"

 // combinations
 'command+shift+k'

 // map multiple combinations to the same callback
 Mousetrap.bind(['command+k', 'ctrl+k'], function() {
     console.log('command k or control k');

     // return false to prevent default browser behavior
     // and stop event from bubbling
     return false;
 });

 // gmail style sequences
 'g i'
 '* a'

 // konami code!
 Mousetrap.bind('up up down down left right left right b a enter', function() {
     console.log('konami code');
 });