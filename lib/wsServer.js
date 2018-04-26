/**
 * Created by wudan on 2017/8/4.
 */
var wsServerClass = require('ws').Server;
var config        = require('./config');
var remote        = require('./remote.js');
var uuid          = require('node-uuid');
var _             = require('lodash');
var logger        = require('./logger');
var safeJsonParse = require('safe-json-parse/tuple');
var utils         = require('./utils');
var jutils        = require('jingtum-lib').utils;
var async         = require('async');



function WsServer(wsPort, host, callback) {
    this.remote = remote;
    this.remote.subscribe('transactions');
    this.remote.on('transactions', _.bind(this.receivedTx, this));
    this.remote.on('ledger_closed', _.bind(this.receiveLedger,this));
    this.remote.on('disconnect', _.bind(this.disConnection, this));

    // setup websocket server
    this.server = new wsServerClass({port: wsPort, host: host});
    this.connections = {}; // connection id to ws thread
    this.allConn = {};//subscribe all accounts
    this.accounts = {}; // account to connection id
    this.ledgers = {};//subscribe ledger
    this.server.on('connection', _.bind(this.startConnection, this));


    if (callback) callback();
}

WsServer.prototype.receiveLedger = function (msg) {
    if (!msg) {
        return;
    }
    var data = {};
    data.ledger = msg;
    for(var item in this.ledgers){
        var all_ws = this.ledgers[item].ws;
        if(all_ws.readyState === 1)
            all_ws.send(JSON.stringify(data));
        else if(all_ws.readyState === 3)
            delete this.ledgers[item];
    }
};

/**
 * Process transaction msg from skywelld
 * @param msg
 */
WsServer.prototype.receivedTx = function(msg) {
    if (!msg) {
        return;
    }

    // process normal tx return
    if (!msg.transaction || !msg.meta) {
        logger.info('[WS] receivedTx', msg);
        return;
    }

    var tx = msg.transaction;
    tx.meta = msg.meta;
    var self = this;
    var address1 = msg.transaction.Account;
    var address2 = msg.transaction.Destination;//支付有对家
    if(address2 && self.accounts[address2]){
        parseAndSendTx(tx, address2, self);
    }
    parseAndSendTx(tx, address1,self);

};

/*交易记录过滤（memos、gets、effects）并发送消息*/
function parseAndSendTx(tx, address, self){
    async.waterfall([
        function (callback) {
            var ret = jutils.processTx(tx, address);
            callback(null, ret);
        }, function (_ret, callback) {
            if(_ret.gets){
                utils.taker2pairs(_ret,_ret,_ret.offertype);
                delete _ret.gets;
                delete _ret.pays;
            }

            if(JSON.stringify(_ret.memos) !== '[]'){
                var m = [];
                for(var q = 0;q < _ret.memos.length; q++){
                    m.push(_ret.memos[q].MemoData);
                }
                _ret.memos = m;
            }

            for(var j = 0;j < _ret.effects.length; j++){
                var e = _ret.effects[j];
                if(e.got || e.gets){
                    utils.taker2pairs(e, e, e.type);
                    delete e.gets;
                    delete e.pays;
                }
            }
            var _ret1 ={
                account: address,
                success: true,
                type: tx.TransactionType,
                transaction: _ret
            };
            callback(null,_ret1);
        }
    ],function(err,res){
        for(var item in self.allConn){
            var all_ws = self.allConn[item].ws;
            if(all_ws.readyState === 1){
                if(res)
                    all_ws.send(JSON.stringify(res));
                else all_ws.send(JSON.stringify(err));
            }else if(all_ws.readyState === 3){
                delete self.allConn[item];
            }
        }
        if(self.accounts[address]){
            for (var id in self.accounts[address].connections) {
                var ws = self.connections[id].ws;
                if(ws.readyState === 1){
                    if(res)
                        ws.send(JSON.stringify(res));
                    else ws.send(JSON.stringify(err));
                }else if(all_ws.readyState === 3){
                    delete self.connections[id];
                }
            }
        }
    });
}


/**
 * Client subscribe connection is coming
 * @param ws
 */
WsServer.prototype.startConnection = function(ws) {
    // process client msg
    function incoming(_ws, _id, _msgRaw) {
        // here this is WsServer instance
        var msgObj = this.msgParser(_msgRaw);
        var error = '';
        logger.info('[WS] incoming', _id, msgObj.account);
        if (msgObj.success) {
            if (msgObj.command === 'subscribe') {
                //msgObj.type = 'subscribe';
                var connId = self.connections[_id];
                if(msgObj.type === 'transactions'){//存储订阅所有消息的用户连接
                    self.allConn[id] = connId;
                    delete self.connections[_id];
                }
                if(msgObj.type === 'ledger'){
                    self.ledgers[id] = connId;
                    delete self.connections[_id];
                }

                if (error = this.subscribe(_ws, _id, msgObj)) {
                    msgObj.success = false;
                    msgObj.error = error;
                }
                // remove secret
                //delete msgObj.command;
                delete msgObj.secret;
            } else if (msgObj.command === 'unsubscribe') {
                //msgObj.type = 'unsubscribe';
                if (error = this.unsubscribe(_ws, _id, msgObj)) {
                    msgObj.success = false;
                    msgObj.error = error;
                }
                //delete msgObj.command;
            } else if (msgObj.command === 'close') {
                _ws.send(JSON.stringify({
                    success: true,
                    type: 'close'
                }));
                _ws.close();
                closing(_id);
                logger.info('[WS] disconnected:', _id, 'connections:', Object.keys(this.connections).length);
                return;
            }else{
                msgObj.success = false;
                //msgObj.type = msgObj.command;
                msgObj.error = 'invalid command';
                //delete msgObj.secret;
                //delete msgObj.command;
            }
        }
        this.outgoing(null, JSON.stringify(msgObj), _ws);
    }

    var id = uuid.v4();

    ws.on('message', _.bind(incoming, this, ws, id));

    var self = this;
    function closing(_id) {
        if (!self.connections[_id]) return;

        for (var acct in self.connections[_id].accounts) {
            if (self.accounts[acct]) {
                delete self.accounts[acct].connections[_id];
            }
        }
        delete self.connections[_id];
    }

    ws.on('close', _.bind(closing, this, id));

    this.connections[id] = {
        ws: ws,
        accounts: {} // one connection has many accounts
    };

    var outMsg = JSON.stringify({
        success: true,
        type: 'connection',
        id: id
    });
    this.outgoing(id, outMsg, ws);

    logger.info('[WS] connected:', id, 'connections:', Object.keys(this.connections).length);
};

/**
 * Write msg to client
 */
WsServer.prototype.disConnection = function() {
    logger.error('[WS] disconnected to jingtum');
    var self = this;
    function hi() {}
    this.remote.on('reconnect',function () {
        logger.info('[WS] reconnect to jingtum');
        // self.remote.removeListener('transactions',hi);
        self.remote.on('transactions', hi);
    });
};


/**
 * Write msg to client
 * @param id
 * @param msg
 * @param ws
 */
WsServer.prototype.outgoing = function(id, msg, ws) {
    if (ws) {
        ws.send(msg);
    } else if (this.connections[id] && this.connections[id].ws) {
        this.connections[id].ws.send(msg);
    }
};

/**
 * Parse client msg
 * @param msg
 * @returns {*}
 */
WsServer.prototype.msgParser = function(msg) {
    var result = safeJsonParse(msg);
    if (result[0]) {
        return {
            success: false,
            error: result[0].toString()
        };
    } else {
        var msgObj = {
            success: true
        };
        for(var m in result[1]){
            msgObj[m] = result[1][m];
        }
        return msgObj;
    }

    return {success: false};
};

/**
 * process client subscribe
 * @param ws
 * @param id
 * @param account
 */
WsServer.prototype.subscribe = function(ws, id, msg) {
    if(!/^transactions|ledger|account$/.test(msg.type)){
        return 'invalid type';
    }
    if(msg.type === 'account'){
        if(!msg.account){
            return "missing account";
        }
        if (!jutils.isValidAddress(msg.account)) {
            return "account is not valid jingtum address";
        }
    }
    if(this.connections[id]){
        var account = msg.account;
        this.connections[id].accounts[account] = true;
        if (!this.accounts[account]) {
            this.accounts[account] = {
                connections: {}
            };
        }
        this.accounts[account].connections[id] = true;
    }

    return null;
};

WsServer.prototype.unsubscribe = function(ws, id, msg) {
    if(!/^transactions|ledger|account$/.test(msg.type)){
        return 'invalid type';
    }

    if(msg.type === 'ledger'){
        delete this.ledgers[id];
    }
    if(msg.type === 'transactions'){
        delete this.allConn[id];
    }
    // remove account subscribe
    if(msg.type === 'account'){
        var account = msg.account;
        if (!account) {
            return "account is missing";
        }
        // check account
        if (!jutils.isValidAddress(account)) {
            return "account is not valid jingtum address";
        }
        if (this.connections[id].accounts[account]) {
            delete this.connections[id].accounts[account];
            delete this.accounts[account].connections[id];
        }
    }

    return null;
};

exports.WsServer = WsServer;

