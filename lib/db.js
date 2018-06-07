/**
 * Created by wudan on 2017/8/3.
 */
var mysql = require('mysql');
var logger  = require('./logger');
var config = require('./config.js');
var pool = mysql.createPool(config.get('mysql_server'));

function query(sql,callback){
    pool.getConnection(function (err, conn) {
        if(err){
            logger.error('db err: ', err);
            return;
        }
        conn.query(sql, function (err, rows) {
            callback(err,rows);
            conn.release();
        });
    });
}

//建表
query('CREATE TABLE if not exists payment(' +
    'client_id varchar(20) not null primary key,' +
    'hash varchar(64),' +
    'source varchar(34),' +
    'destination varchar(34),' +
    'amount varchar(100),' +
    'memos varchar(255),' +
    'choice varchar(255),' +
    'date bigint, ' +
    'result tinyint);', function (err, res) {
    if(err)
        logger.error('create table payment err:',err);
    else
        logger.info('created table payment succeed!');
});
query('CREATE TABLE if not exists ips(' +
    'id int(11) NOT NULL AUTO_INCREMENT primary key,' +
    'ip varchar(255) NOT NULL,' +
    'date datetime);', function (err, res) {
    if(err)
        logger.error('create table ips err:',err);
    else
        logger.info('created table ips succeed!');
});

module.exports = query;