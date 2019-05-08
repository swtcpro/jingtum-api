var request = require('request');

var root = {'secret':'snoPBjXtMeMyMHUVTgbuqAfg1SUTb',//合约根账号
    'address':'jHb9CJAWyB4jr91VRWn96DkukG4bwdtyTh'};
//contract 测试
function send(seq) {
    var option = {
        url: 'http://localhost:3002/v2/accounts/jHb9CJAWyB4jr91VRWn96DkukG4bwdtyTh/contract/call',
        method: 'POST',
        json: true,
        headers: {
            "content-type": "application/json"
        },
        body: {
            "secret": "snoPBjXtMeMyMHUVTgbuqAfg1SUTb",
            "amount": "10",
            "payload": "result={};  function Init(t)  result=scGetAccountBalance(t)  return result  end;  function foo(t)  result=scGetAccountBalance(t)  return result  end",
            "params": ['jHb9CJAWyB4jr91VRWn96DkukG4bwdtyTh'],
            "sequence": seq
        }
    };

    request(option, function (error, response, body) {
        if (!error && response.statusCode === 200) {
            console.log('body 1:',body);
        }else{
            console.log('error: ',error);
            console.log('body: ',body);
        }
    });
}

/*
{ success: true,
  status_code: '0',
  client_id: '20180627376',
  hash: 'B67AB7450A82F6A950F64E35388E406492C0E139AE7AF4E0F46CD0BC7E3C7875',
  result: 'terPRE_SEQ',
  fee: 0.01 }
* */

for(var i = 1322 ;i < 1332; i++){
    send(i);
}


