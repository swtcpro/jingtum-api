# Jingtum API

The Jingtum API Provides a simple, easy-to-use interface to the Jingtum
blockchain netwrok via a RESTful API. It includes functions as follow,

 - Provide basic interfaces transaction
 - Manage connection with Jingtum network
 - Provider transaction and ledger subscribtion
 
Jingtum API keeps interfaces with Jingtum SDK, and will replace Jingtum REST
API that Jingtum SDK uses now.

## Architecture

Jingtum API is express app with redis and msyql.

## API Interface 

See Swagger.JSON

## Advanced Functions

 - Manage connection with many PS
 - Cache client requests, and make high performance system
 - Use node.js cluster feature
 
## Quick Start

1. Clone Jingtum API repository with git
`git clone http://git.jingtum.com/root/jingtum-api.git`

2. Install dependenies
`npm install`

3. Configure enviroments
`cp config-example.json config.json`

4. Start server
make log dirs
`mkdir logs`, start server, `node server.js` or use pm2 `pm2 start server.js`


