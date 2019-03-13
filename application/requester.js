const Web3 = require('web3')
const web3 = new Web3('ws://127.0.0.1:8546')

const fs = require('fs')
const dns = require('dns')
const BN = web3.utils.BN;



const contract_info = JSON.parse(fs.readFileSync('../smart-contract/contract_info.json', 'utf8'))
const ddns_contract_address = contract_info['ddns_contract_address']
const ddns_contract_abi = contract_info['ddns_contract_abi']
const ddns_contract = new web3.eth.Contract(ddns_contract_abi, ddns_contract_address)

const alexa_top_list = fs.readFileSync('../../experiment/alexa_list/top_1m.txt', 'utf-8').split('\n')


// const request = process.argv[2]
// const domain = process.argv[3]

// web3.eth.getAccounts()
// .then((value) => {
// 	web3.eth.defaultAccount = value[0]
// })
// .catch((err) => {
// 	console.log('Cannot get accounts', err)
// })
// .then(() => {
// 	let type
// 	if (request == 'ip') {
// 		type = 1
// 	}
// 	else if (request == 'ownership') {
// 		type = 2
// 	}
// 	else {
// 		console.log('wrong reuqest command')
// 		process.exit()
// 	}
// 	request_domain = web3.utils.toHex(domain)
// 	let cost = 0
// 	ddns_contract.methods.request(type, request_domain, cost).send({
// 		from: web3.eth.defaultAccount,
// 		gas: 3000000
// 	})
// 	.on('receipt', (receipt) => {
// 		console.log('voting hash: ', receipt.events.NewRequest.returnValues.hash)
// 		process.exit()
// 	})
// })
// .catch((err) => {
// 	console.log('Cannot assign default account.', err)
// })





let interval = 10000
domains = alexa_top_list.slice(0,99)
domains.push('dnsoneth.xyz')

let index = 0
let type = 2
let cost = 0
web3.eth.getAccounts()
.then((value) => {
	web3.eth.defaultAccount = value[0]
	setInterval(() => {	
		if (index == domains.length) {
			process.exit()
		}
		send_request(type, domains[index], cost)
		console.log('request sent', domains[index])
		index += 1
	}, interval)
})
.catch((err) => {
	console.log('Cannot assign default account.', err)
})



function send_request(type, domain, cost) {
	let request_domain = web3.utils.toHex(domain)
	ddns_contract.methods.request(type, request_domain, cost).send({
		from: web3.eth.defaultAccount,
		gas: 3000000
	})
}



