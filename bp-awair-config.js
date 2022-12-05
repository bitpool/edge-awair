/*
  MIT License Copyright 2021, 2022 - Bitpool Pty Ltd
*/

module.exports = function (RED) {  
  function bpBitpoolawairConfig(config) {
    var node = this;
    RED.nodes.createNode(node, config);

    node.Name = config.Name;
    node.OrgID = config.OrgID;
    node.Token = config.Token;

    this.status({});
	
  }

  RED.nodes.registerType("bp-awair-config", bpBitpoolawairConfig);

};
