var Web3 = require('web3')
var fs = require('fs')


var web3 = new Web3('ws://127.0.0.1:8545')
web3.eth.defaultAccount = '0xc9e484f6cd17e352fa592b7827401e7666eac079'

var token_contract_addr = '0xb0c13d0cc0f3edcea77133f9885e0d7a656334e0'
var token_contract_abi = JSON.parse(fs.readFileSync('../token_contract_abi.json', 'utf8'))

var token_contract = new web3.eth.Contract(token_contract_abi, token_contract_addr)

//token_contract.getPastEvents('AllEvents', { fromBlock:0, toBlock:'latest'}, (err, events) => {console.log(events)})


function handle_event(event) {
	
	var event_name = event.event
	var return_value = event.returnValues

	console.log(event_name)
	console.log(return_value)
	

}

function handle_changed(events) {
	console.log("handle_changed")
}

token_contract.events.Transfer({fromBlock: 0})
	.on('data', (event) => {handle_event(event)})
	.on('changed', (event) => {handle_changed(event)})
	.on('error', (event) => {console.error})

