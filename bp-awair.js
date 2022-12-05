/*
  MIT License Copyright 2021, 2022 - Bitpool Pty Ltd
*/

const { Console } = require('console');

// GLOBAL VARIABLES ------------------------------------------------------------------
var Current_Config = null;                                                            // This holds the current selected configuration (works as a global)

module.exports = function (RED) {

  const fetch = require('node-fetch');
  const https = require("https");
  
  function bpBitpoolAwair(config) {
    var node = this;
    RED.nodes.createNode(node, config);

    // Declare a context object for this node
    var NodeContext = this.context().flow;

    node.bpAwairDisplayName = config.bpAwairDisplayName;
    node.bpAwairShowNodeStatus = config.bpAwairShowNodeStatus;
    node.bpAwairShowDebugWarnings = config.bpAwairShowDebugWarnings;
    node.bpAwairJSONOutput = config.bpAwairJSONOutput;
    node.bpAwairIndividualOutput = config.bpAwairIndividualOutput;
    node.bpAwairCurrentDevice = config.bpAwairCurrentDevice;
    node.bpAwairRoundingEnabled = config.bpAwairRoundingEnabled;
    node.bpAwairRoundingPlaces = config.bpAwairRoundingPlaces;

    Current_Config = RED.nodes.getNode(config.bpAwairToken);                          // Read in the current config
    
    var Request_Bucket = 3;                                                           // Declare the bucket used for rate limiting the requests
    var Max_Requests_Available = 3;                                                   // Set the number of maxmimum allowable requests in the bucket
    setInterval(Handle_Rate_Limit, 7000);                                             // Schedule the request bucket refill operation

    this.status({});

    node.on("input", function (msg) {                                                 // Upon receiving an input message to the node
      try {
        if(Request_Bucket > 0){                                                       // If the number of available requests is greater than zero
          GetLatestAirData(msg);                                                      // Query the api for the latest air data for the current device
          Request_Bucket--;                                                           // Decrease the number of available requests
        }
        else{                                                                         // If there are no remaining requests available
          // Display a warning message that the API rate limit has been reached
          if(node.bpAwairShowDebugWarnings == true){node.warn("API request rate limit has been reached. Please wait a few seconds and try again.")};
          
          // If show node status is enabled show an error
          if(node.bpAwairShowNodeStatus == true){node.status({fill:"red",shape:"dot",text:"E09: API rate limit reached."});}                        
        }                                   
      } 
      catch (err) {                                                                   // Catch any errors that occur
        msg.payload = err;                                                            // Set the message playload to be the error
        node.send(msg);                                                               // Send the resulting message
      } 
      finally {
      }
    });

    // HANDLE RATE LIMIT FUNCTION ====================================================
    // This function is used to add to the number of available requests and also 
    // limit the maxmimum number of available requests.
    // ===============================================================================
    function Handle_Rate_Limit(){
      Request_Bucket++;                                                               // Fill up the available requests bucket
      if(Request_Bucket > Max_Requests_Available){                                    // If the bucket has reached the max allowable number of requests
        Request_Bucket = Max_Requests_Available;                                      // Limit the bucket to 10 requests
      }           
    }
	
    // DECLARE ENDPOINTS ------------------------------------------------------------- 
    RED.httpAdmin.get('/bitpool-Awair-data/getDevices/', GetDevicesCallback);

    // GET DEVICES CALLBACK FUNCTION =================================================
    // This function returns the current list of devices from the api.
    // ===============================================================================
    function GetDevicesCallback(req, res){  
      
      if(node.bpAwairShowNodeStatus == true){                                         // If the show node status option is checked
        node.status({fill:"green",shape:"ring",text:"Requesting data..."});           // Update the node status
      }

      if(Current_Config != null){                                                     // If a config exists
      
        var Authetification_Token = Current_Config.Token;                             // Get the Authentification Token from the config node
        var Orgaisation_ID = Current_Config.OrgID;                                    // Get the Organisation ID from the config node

        fetch("https://developer-apis.awair.is/v1/orgs/" + Orgaisation_ID + "/devices", {
          method: 'GET',
          headers: {'x-api-key':Authetification_Token}
          })
          .then(res => res.json())
          .then(json => {
            if (json != ""){

              res.send(json);                                                         // Return the list of devices
    
              // If there was an authentificaiton error
              if(JSON.stringify(json).includes("failed to authenticate the request")){ 
                if(node.bpAwairShowDebugWarnings == true){node.warn("ERROR 01: Authenification error. Please check your node settings and try again.");} // If show warning in the debug tab is enabled then output the error
                if(node.bpAwairShowNodeStatus == true){node.status({fill:"red",shape:"dot",text:"E01: Authenification error."});}                        // If show node status is enabled show an error
              }
              else{                                                                   // If Authentification was ok
                if(node.bpAwairShowNodeStatus == true){                               // If the show node status option is checked
                  node.status({fill:"green",shape:"dot",text:"Ready"});               // Update the node status
                }  
              }
            }
          })
          .catch(err => {                                                             // Catch any errors
            console.log(err);                                                         // Output the errors to the console
            if(node.bpAwairShowDebugWarnings == true){node.warn("ERROR 02: Error discovering devices. Please check your node settings and try again.");} // If show warning in the debug tab is enabled then output the error
            if(node.bpAwairShowNodeStatus == true){node.status({fill:"red",shape:"dot",text:"E02: Error discovering devices."});}                        // If show node status is enabled show an error
            res.send("ERROR 02: Error discovering devices. Please check your node settings and try again.");                                             // Send a response message to the browser
          });  

      }
      else{                                                                           // If a config does not exist
        if(node.bpAwairShowDebugWarnings == true){node.warn("ERROR 03: Authentifcation not configured. Please create / select a configuration and try again.");}
        if(node.bpAwairShowNodeStatus == true){node.status({fill:"red",shape:"ring",text:"E03: Authentifcation not configured."});}                      // If show node status is enabled show an error
        res.send("ERROR 03: Authentifcation not configured. Please create / select a configuration and try again.");                                     // Send a response message to the browser
      }

    } 

    // MAKE GET REQUEST FUNCTION =====================================================
    // This function makes a GET request using the node-fetch library. It takes 
    // arguments of the URL, the deired topic of the msg that is returned and the 
    // incoming msg object to be passed on (optional).
    // ===============================================================================
    function MakeGetRequest(URL, Return_Topic, msg){

      if(Current_Config != null){                                                     // If a config exists

        var Authetification_Token = Current_Config.Token;                             // Get the Authentification Token from the config node

        if(node.bpAwairShowNodeStatus == true){                                       // If the show node status option is checked
          node.status({fill:"green",shape:"ring",text:"Requesting data..."});         // Update the node status
        }  

        fetch(URL, {
          method: 'GET',
          headers: {'x-api-key':Authetification_Token}
          })
          .then(res => res.json())
          .then(json => {

            if (json != ""){

              // If there was an authentificaiton error
              if(JSON.stringify(json).includes("failed to authenticate the request")){ 
                if(node.bpAwairShowDebugWarnings == true){node.warn("ERROR 04: Authenification error. Please check your node settings and try again.");} // If show warning in the debug tab is enabled then output the error
                if(node.bpAwairShowNodeStatus == true){node.status({fill:"red",shape:"dot",text:"E04: Authenification error."});}                        // If show node status is enabled show an error
              }
              else{

                // Handle JSON Block Output Format
                if(node.bpAwairJSONOutput == true){
                  msg.topic = Return_Topic;
                  msg.topic = msg.topic.toUpperCase();                                // Make the message topic upper case
                  msg.topic = msg.topic.replace(/\!|\@|\#|\$|\%|\^|\&|\*|\(|\)|\+|\=|\<|\>|\?|\"|\{|\}|\[|\]|\'|\~|\:/g, ""); 	// Remove special characters.
                  msg.topic = msg.topic.replace(/\s{1,}/g, "_"); 	                    // Replace all spaces (including more than one space at a time) with an underscore.
                  msg.payload = json;                                                 // Set the message payload to the json object
                  node.send(msg);                                                     // Send the resulting message                                                  
                }

                // Handle Individual Message Output Format
                if(node.bpAwairIndividualOutput == true){

                  for(var sensor of json.data[0].sensors){                            // Loop through all of the sensors of the device
                    var msg2 = {};                                                    // Clear the message object for each new device
                    msg2.topic = Return_Topic + "/" + sensor.comp;                    // Set the desired topic path
                    msg2.topic = msg2.topic.toUpperCase();                            // Make the message topic upper case

                    msg2.topic = msg2.topic.replace(/\!|\@|\#|\$|\%|\^|\&|\*|\(|\)|\+|\=|\<|\>|\?|\"|\{|\}|\[|\]|\'|\~|\:/g, ""); 	// Remove special characters.
                    msg2.topic = msg2.topic.replace(/\s{1,}/g, "_"); 	                // Replace all spaces (including more than one space at a time) with an underscore.

                    if(node.bpAwairRoundingEnabled == true)                           // If rounding is enabled
                      {
                      msg2.payload = parseFloat(sensor.value.toFixed(node.bpAwairRoundingPlaces));  // Round the values to requested number of decimal places
                      
                    }
                    else{                                                             // Otherwise if rounding is disabled
                      msg2.payload = sensor.value;                                    // Output the original values                                       
                    }
                    
                    node.send(msg2);                                                  // Send the resulting message
                  }

                }

                if(node.bpAwairShowNodeStatus == true){                               // If the show node status option is checked
                  node.status({fill:"green",shape:"dot",text:"Ready"});               // Update the node status
                }  
              }
              
            }

          })
          .catch(err => {                                                             // Catch any errors
            console.log(err);                                                         // Output the errors to the console
            if(node.bpAwairShowDebugWarnings == true){node.warn("ERROR 05: Error requesting data. Please check your node settings and try again.");} // If show warning in the debug tab is enabled then output the error
            if(node.bpAwairShowNodeStatus == true){node.status({fill:"red",shape:"dot",text:"E05: Error requesting data."});}                        // If show node status is enabled show an error
          }); 
        
      }
      else{
        if(node.bpAwairShowDebugWarnings == true){node.warn("ERROR 06: Authentifcation not configured. Please create / select a configuration and try again.");} // If show warning in the debug tab is enabled then output the error
        if(node.bpAwairShowNodeStatus == true){node.status({fill:"red",shape:"ring",text:"E06: Authentifcation not configured."});}                              // If show node status is enabled show an error
      }
      
    }

    // GET LATEST AIR DATA FUNCTION ==================================================
    // This functions returns the latest air data for the current device. It accepts 
    // an argument of the incoming msg object to be passed on.
    // ===============================================================================
    function GetLatestAirData(msg){

      if(Current_Config != null){                                                     // If a config exists

        var Orgaisation_ID = Current_Config.OrgID;                                    // Get the Organisation ID from the config node

        var Selected_Device = node.bpAwairCurrentDevice;                              // Get the current device selection
        if(Selected_Device != "Please Select a Device"){                              // If a valid device has been selected
          var Selected_Device_Data = Selected_Device.split(" - ");                    // Split the data up based on the dashes
          var Selected_Device_Name = Selected_Device_Data[0];                         // Store the device name
          var Selected_Device_ID = Selected_Device_Data[1];                           // Store the device id
          var Selected_Device_Type = Selected_Device_Data[2];                         // Store the device type
          MakeGetRequest("https://developer-apis.awair.is/v1/orgs/" + Orgaisation_ID + "/devices/" + Selected_Device_Type  + "/" + Selected_Device_ID + "/air-data/latest", Orgaisation_ID + "/" + Selected_Device_Type + "/" + Selected_Device_Name + "_" + Selected_Device_ID, msg);
        }
        else{                                                                         // If a device has not been selected
          if(node.bpAwairShowDebugWarnings == true){node.warn("ERROR 07: Device not configured. Please select an appropriate device and try again.");} // If show warning in the debug tab is enabled then output the error
          if(node.bpAwairShowNodeStatus == true){node.status({fill:"red",shape:"ring",text:"E07: Device not configured."});}                           // If show node status is enabled show an error
        }

      }
      else{                                                                           // If a config does not exist
        if(node.bpAwairShowDebugWarnings == true){node.warn("ERROR 08: Authentifcation not configured. Please create / select a configuration and try again.");} // If show warning in the debug tab is enabled then output the error
        if(node.bpAwairShowNodeStatus == true){node.status({fill:"red",shape:"ring",text:"E08: Authentifcation not configured."});}                              // If show node status is enabled show an error
      }
    }
    
  }

  RED.nodes.registerType("bp-Awair", bpBitpoolAwair);

};