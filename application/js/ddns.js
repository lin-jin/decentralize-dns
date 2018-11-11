var Web3 = require('web3')
var fs = require('fs')


var web3 = new Web3('http://127.0.0.1:8545')
web3.eth.defaultAccount = '0x4c023d8a18d4d9c86751250988c974d812405973'

var token_contract_addr = '0xcc2aba9cdfd6f1e1bcacbfda8cef225962a00542'
var token_contract_abi = JSON.parse(fs.readFileSync('../token_contract_abi.json', 'utf8'))

var token_contract = new web3.eth.Contract(token_contract_abi, token_contract_addr)

//token_contract.getPastEvents('AllEvents', { fromBlock:0, toBlock:'latest'}, (err, events) => {console.log(events)})

token_contract.events.Transfer({fromBlock: 0}, function(error, event){ console.log(error) })
	.on('data', (log) => {console.log(log)})
	.on('changed', (log) => {console.log(log)})
	.on('error', (log) => {console.error})

