// ***********************************************************************
// This example demonstrates how interface to a TP5000 LiFePo4 charger
// by sending a message to mqtt with information about charger operation
// ***********************************************************************

load('api_timer.js');
load('api_gpio.js');
load('api_mqtt.js');
load('api_rpc.js');
load('api_sys.js');

let DEVICE_ID;

let STDBY_PIN =				13;		// D7 TP5000 /STDBY OUTPUT (GREEN)
let CHRG_PIN =				12;		// D6 TP5000 /CHRG OUTPUT (RED)
let CHRG_PULSE_PIN =		14;		// D5 TP5000 /CHRG OUTPUT (RED) pulse detection
let DEBOUNCE_STATUS_MS =	200;
let DEBOUNCE_PULSE_MS =		1;
let PULSE_DETECT_MS =		2500;

let STATUS_CHGIN = 			1;		// Charging
let STATUS_CHGED = 			2;		// Charged
let STATUS_FAULT = 			3;		// Fault
let STATUS_STDBY = 			4;		// Standby

let STATUS_CHGIN_STR = 		'Charging';
let STATUS_CHGED_STR = 		'Charged';
let STATUS_FAULT_STR = 		'Fault';
let STATUS_STDBY_STR = 		'Standby';

let TOPIC_UL = '/mosiotlifepo4charger/status';

let pulse_detected = 0;
let pulse_counter = 0;
let charger_status = 0;
let charger_status_str = '';
let charger_prev_status = 0;
let message_ul={"sensor_id":"","status":""};

// read self device info
RPC.call(RPC.LOCAL, 'Sys.GetInfo', null, function(resp, ud) {
  DEVICE_ID = resp.id;
},null);

// ************************************************
// Build MQTT uplink message
// ************************************************

function buildMsgUl(){
	message_ul.sensor_id=DEVICE_ID;	
	message_ul.status=charger_status_str;			
}
// ******************************************************************
//	TP5000 LIGHT STATUS (Leds are turned on when signals pulled low)
//
//	GREEN STDBY		RED CHRG		STATUS
//	OFF				ON				charging
//	ON				OFF				fully charged
//	OFF				OFF				fault
//	PULSE OFF		PULSE ON		standby (from datasheet pulse interval between 0.5s to 2s. Pulse width measured ~1.5ms)
// ******************************************************************

function chargerStatus(){
		
	if(pulse_counter < 1)
	{
		if(GPIO.read(STDBY_PIN)===1 && GPIO.read(CHRG_PIN)===0)
		{	
			charger_status = STATUS_CHGIN;
			charger_status_str = STATUS_CHGIN_STR;
		}
	
		if(GPIO.read(STDBY_PIN)===0 && GPIO.read(CHRG_PIN)===1)
		{	
			charger_status = STATUS_CHGED;			
			charger_status_str = STATUS_CHGED_STR;			
		}
	
		if(GPIO.read(STDBY_PIN)===1 && GPIO.read(CHRG_PIN)===1)
		{	
			charger_status = STATUS_FAULT;			
			charger_status_str = STATUS_FAULT_STR;			
		}
	}
	else
	{
		if(pulse_counter > 1 )
		{
			charger_status = STATUS_STDBY;
			charger_status_str = STATUS_STDBY_STR;
			pulse_counter=0;
		} 		
	}

	// Print/publish only when status changes
	if(charger_prev_status !== charger_status)
	{
		if(charger_status === STATUS_CHGIN)
		{
			charger_status_str = STATUS_CHGIN_STR;
		}
		if(charger_status === STATUS_CHGED)
		{
			charger_status_str = STATUS_CHGED_STR;
		}	
		if(charger_status === STATUS_FAULT)
		{
			charger_status_str = STATUS_FAULT_STR;
		}
		if(charger_status === STATUS_STDBY)
		{
			charger_status_str = STATUS_STDBY_STR;
		}	
		print(charger_status_str);
		buildMsgUl();	
		let okul = MQTT.pub(TOPIC_UL, JSON.stringify(message_ul), 1);
  		print('Published:', okul, TOPIC_UL, '->', message_ul);  		
	}
	charger_prev_status = charger_status;						
}


// ************************************************
// GPIO interrupts to detect charger status changes
// ************************************************
GPIO.set_button_handler(STDBY_PIN, GPIO.PULL_UP, GPIO.INT_EDGE_ANY, DEBOUNCE_STATUS_MS, function(pin) {  
  pulse_counter=0;
  chargerStatus();
}, true);


GPIO.set_button_handler(CHRG_PIN, GPIO.PULL_UP, GPIO.INT_EDGE_ANY, DEBOUNCE_STATUS_MS, function(pin) {  
  pulse_counter=0;
  chargerStatus();
}, true);

GPIO.set_button_handler(CHRG_PULSE_PIN, GPIO.PULL_UP, GPIO.INT_EDGE_NEG, DEBOUNCE_PULSE_MS, function(pin) {  
  if(pulse_detected === 0)
  {
  	pulse_detected=1;
  }    
}, true);

// *********************************************
// Crude pulse detector, needs more craftmanship
// *********************************************
Timer.set(PULSE_DETECT_MS, Timer.REPEAT, function() {
  if(pulse_detected === 1)
  {
  	pulse_counter++;
	pulse_detected = 0;
  }    
  chargerStatus();
}, null);
