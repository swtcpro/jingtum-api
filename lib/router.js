const express = require('express');
const account = require('./../api/account');
const balances= require('./../api/balances');
const payment = require('./../api/payment');
const offer   = require('./../api/offer');
const transaction = require('./../api/transaction');
const contract = require('./../api/contract');
const sign = require('./../api/sign');
const relations = require('./../api/relation');
const ledger = require('./../api/ledger');
const utils = require('./../lib/utils');
const db = require('./../lib/db');
var logger  = require('../lib/logger');
var dateformat = require('dateformat');

var router = new express.Router();

router.IndexPage = function(req, res) {
	res.send('Welcome to jingtum api server');
};

router.get('/', router.IndexPage);

router.all('*', function(req, res, next) {
	res.header("Cache-Control", "no-cache, no-store, must-revalidate");
  	res.header("Pragma", "no-cache");
  	res.header("Expires", 0);
  	var ip = utils.getClientIp(req);
  	// var time = new Date().toISOString();//标准时间
    var now = new Date();
    var time = dateformat(now, "yyyy-mm-dd HH:MM:ss");
    logger.info('ip: ', ip);
    logger.info('time: ', time);
    db("insert into ips(ip, date) values('" + ip + "','" + time + "')", function (err, result) {
        if(err){
            logger.error('save ips err:',err);
        }else
            logger.info('saved to ips successfully!');
    });

  	next();
});

// accounts
router.get('/wallet/new', account.generate);
router.get('/accounts/:account/balances', balances.getBalance); //Balances

router.get('/accounts/:source_address/payments/choices/:destination_address/:amount',payment.getChoices);//查询支付选择
router.post('/accounts/:source_address/payments',payment.submitPayment);//支付请求
router.get('/accounts/:address/payments/:id',payment.getPayment);//获得支付信息
router.get('/accounts/:address/payments',payment.getPayments);//获得支付历史

router.post('/accounts/:address/orders',offer.submitOrder);//提交挂单
router.delete('/accounts/:address/orders/:order',offer.cancelOrder);//取消挂单
router.get('/accounts/:address/orders',offer.getOrders);//获得用户挂单
router.get('/accounts/:address/orders/all',offer.getOrders2);//获得用户所有挂单
router.get('/accounts/:address/orders/:hash',offer.getOrder);//获得挂单信息
router.get('/order_book/:base/:counter',offer.getOrderBook);//获得货币对的挂单列表
router.get('/order_book/bids/:base/:counter',offer.getBids);//获得买单货币对的挂单列表
router.get('/order_book/asks/:base/:counter',offer.getAsks);//获得买单货币对的挂单列表

router.get('/accounts/:address/transactions/:hash',transaction.getTx);//查询交易信息
router.get('/accounts/:address/transactions',transaction.getTxs);//查询交易记录
router.get('/transactions/:hash',transaction.getTx2);//查询交易信息

router.post('/accounts/:address/contract/deploy',contract.deployContract);//部署合约
router.post('/accounts/:address/contract/call',contract.callContract);//调用合约

router.post('/blob',sign.submitSign);//提交签名

router.post('/accounts/:address/relations',relations.setRelations);//关系设置
router.get('/accounts/:address/relations',relations.getRelations);//关系查询
router.delete('/accounts/:address/relations',relations.delFreeze);//关系移除

router.get('/ledger/index',ledger.getBlockNumber);//当前账本号查询
router.get('/ledger/hash/:hash',ledger.getLedgerTx);//通过账本hash获得账本信息及该账本里的交易记录
router.get('/ledger/index/:index',ledger.getLedgerTx2);//通过账本号获得账本信息及该账本里的交易记录


module.exports = router;

