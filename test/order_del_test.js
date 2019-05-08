var request = require('request');

//order delete测试
function send(delSeq, seq) {
    var option = {
        url: 'http://localhost:3002/v2/accounts/jB7rxgh43ncbTX4WeMoeadiGMfmfqY2xLZ/orders/' + delSeq,
        method: 'Delete',
        json: true,
        headers: {
            "content-type": "application/json"
        },
        body: {
            "secret": "sn37nYrQ6KPJvTFmaBYokS3FjXUWd",
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
  hash: '6543745BE79D674F7DAA0CA48F2B0F3AB86E17556E59EA3F1722BAEA33952AF3',
  result: 'terPRE_SEQ',
  fee: 0.01,
  sequence: 417 }
* */
var j = 401;
for(var i = 411 ;i < 418; i++){
    send(j++, i);
}


