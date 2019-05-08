var request = require('request');

//payment测试
function send(client_id, seq) {
    var option = {
        url: 'https://tapi.jingtum.com/v2/accounts/jB7rxgh43ncbTX4WeMoeadiGMfmfqY2xLZ/payments',
        method: 'POST',
        json: true,
        headers: {
            "content-type": "application/json"
        },
        body: {
            "secret": "sn37nYrQ6KPJvTFmaBYokS3FjXUWd",
            "client_id": client_id,
            "payment": {
                "source": "jB7rxgh43ncbTX4WeMoeadiGMfmfqY2xLZ",
                "amount": {
                    "value": "0.5",
                    "currency": "SWT",
                    "issuer": ""
                },
                "destination": "jDUjqoDZLhzx4DCf6pvSivjkjgtRESY62c"
            },
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
  result: 'terPRE_SEQ',//缓存状态，具体是否真正成功需要通过交易记录查询。
  fee: 0.01 }
* */
var client_id = '20180710';
for(var i = 1736 ;i < 1746; i++){//这里的i表示sequence
    send( client_id + i, i);
}


