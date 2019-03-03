const Web3 = require('web3')
const web3 = new Web3('ws://127.0.0.1:8545')

const fs = require('fs')
const dns = require('dns')
const BN = web3.utils.BN;

const request = process.argv[2]
const domain = process.argv[3]

const account_index = 0

const contract_info = JSON.parse(fs.readFileSync('../smart-contract/contract_info.json', 'utf8'))
const domain_token_contract_address = contract_info['domain_token_contract_address']
const domain_token_contract_abi = contract_info['domain_token_contract_abi']
const ddns_contract_address = contract_info['ddns_contract_address']
const ddns_contract_abi = contract_info['ddns_contract_abi']

const domain_token_contract = new web3.eth.Contract(domain_token_contract_abi, domain_token_contract_address)
const ddns_contract = new web3.eth.Contract(ddns_contract_abi, ddns_contract_address)


web3.eth.getAccounts()
.then((value) => {
	web3.eth.defaultAccount = value[account_index]
})
.catch((err) => {
	console.log('Cannot get accounts', err)
})
.then(() => {
	let type
	if (request == 'ip') {
		type = 1
	}
	else if (request == 'ownership') {
		type = 2
	}
	else {
		console.log('wrong reuqest command')
		process.exit()
	}
	request_domain = web3.utils.toHex(domain)
	let cost = 0
	ddns_contract.methods.request(type, request_domain, cost).send({
		from: web3.eth.defaultAccount,
		gas: 3000000
	})
	.on('receipt', (receipt) => {
		console.log('voting hash: ', receipt.events.NewRequest.returnValues.hash)
		process.exit()
	})
})
.catch((err) => {
	console.log('Cannot assign default account.', err)
})
