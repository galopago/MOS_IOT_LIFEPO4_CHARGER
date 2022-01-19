// This example demonstrates how to react on a button press
// by sending a message to AWS IoT.
//
// See README.md for details.
//
// Load Mongoose OS API
load('api_gpio.js');



let pin = 12;   // GPIO 0 is typically a 'Flash' button
GPIO.set_button_handler(pin, GPIO.PULL_UP, GPIO.INT_EDGE_NEG, 50, function(x) {  
  print('Button pressed:');
}, true);

print('Flash button is configured on GPIO pin ', pin);

