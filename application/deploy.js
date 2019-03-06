const Web3 = require('web3')
const web3 = new Web3('ws://127.0.0.1:8545')

const fs = require('fs')
const solc = require("solc")


const token_contract_path = '../smart-contract/Token.sol'
const domain_token_contract_path = '../smart-contract/DomainToken.sol'
const ddns_contract_path = '../smart-contract/DDNS.sol'

const token_contract_source = fs.readFileSync(token_contract_path, 'utf-8')
const domain_token_contract_source = fs.readFileSync(domain_token_contract_path, 'utf-8')
const ddns_contract_source = fs.readFileSync(ddns_contract_path, 'utf-8')


let domain_token_input = {
	language: 'Solidity',
	sources: {
		'Token.sol' : {content: token_contract_source},
		'DomainToken.sol' : {content: domain_token_contract_source},
	},
	settings: {
		outputSelection: {
			'*': {
				'*': [ '*' ]
			}
		}
	}
}


let domain_token_contract_output = JSON.parse(solc.compile(JSON.stringify(domain_token_input)))
let domain_token_contract_abi = domain_token_contract_output.contracts['DomainToken.sol']['DomainToken'].abi
let domain_token_contract_bytecode = '0x' + domain_token_contract_output.contracts['DomainToken.sol']['DomainToken'].evm.bytecode.object
let domain_token_contract = new web3.eth.Contract(domain_token_contract_abi)


let ddns_input = {
	language: 'Solidity',
	sources: {
		'Token.sol' : {content: token_contract_source},
		'DomainToken.sol' : {content: domain_token_contract_source},
		'DDNS.sol' : {content: ddns_contract_source}
	},
	settings: {
		outputSelection: {
			'*': {
				'*': [ '*' ]
			}
		}
	}
}

let ddns_contract_output = JSON.parse(solc.compile(JSON.stringify(ddns_input)))
let ddns_contract_abi = ddns_contract_output.contracts['DDNS.sol']['DDNS'].abi
let ddns_contract_bytecode = '0x' + ddns_contract_output.contracts['DDNS.sol']['DDNS'].evm.bytecode.object
let ddns_contract = new web3.eth.Contract(ddns_contract_abi)


web3.eth.getAccounts((err, accounts) => {
	if(!err) {
		web3.eth.defaultAccount = accounts[0]
		domain_token_contract.deploy({
			data: domain_token_contract_bytecode,
			arguments: [] //pass into constructor
		})
		.send({
			from: web3.eth.defaultAccount,
			gas: 6000000
		}, (err, txhash) => {
			if(err) {
				console.log('deploy domain token contract callback error', err)
			}
		})
		.on('receipt', receipt => {
			domain_token_contract_address = receipt.contractAddress
			console.log('token contract address:', domain_token_contract_address)
			ddns_contract.deploy({
				data: ddns_contract_bytecode,
				arguments: [domain_token_contract_address]
			})
			.send({
				from: web3.eth.defaultAccount,
				gas: 6000000
			}, (err, txhash) => {
				if(err) {
					console.log('deploy ddns contract callback error', err)
				}
			})
			.on('receipt', receipt => {
				ddns_contract_address = receipt.contractAddress
				console.log('ddns contract address:', ddns_contract_address)
				export_contract_info(domain_token_contract_abi, domain_token_contract_address, ddns_contract_abi, ddns_contract_address)
				process.exit()
			})
			.on('error', (err) => {
				console.log('deploy ddns error:', err)
			})
		})
		.on('error', (err) => {
			console.log('deploy token error:', err)
		})
	}
	else {
		console.log('Cannot get account 0, deploy contract failed!')
		process.exit()
	}
})



function export_contract_info(domain_token_contract_abi, domain_token_contract_address, ddns_contract_abi, ddns_contract_address) {
	let data = JSON.stringify({
		domain_token_contract_abi : domain_token_contract_abi,
		domain_token_contract_address : domain_token_contract_address,
		ddns_contract_abi : ddns_contract_abi,
		ddns_contract_address : ddns_contract_address
	}, null, '\t')

	fs.writeFileSync('../smart-contract/contract_info.json', data)
}






























// ************************************************************************************************************************************************************ 


// const Web3 = require('web3')
// const web3 = new Web3('ws://127.0.0.1:8545')

// const fs = require('fs')
// const solc = require("solc")

// const contract = process.argv[2]


// const token_contract_path = '../smart-contract/Token.sol'
// const domain_token_contract_path = '../smart-contract/DomainToken.sol'
// const ddns_contract_path = '../smart-contract/DDNS.sol'

// const token_contract_source = fs.readFileSync(token_contract_path, 'utf-8')
// const domain_token_contract_source = fs.readFileSync(domain_token_contract_path, 'utf-8')
// const ddns_contract_source = fs.readFileSync(ddns_contract_path, 'utf-8')



// if (contract == 'domain_token'){
// 	let domain_token_input = {
// 		language: 'Solidity',
// 		sources: {
// 			'Token.sol' : {content: token_contract_source},
// 			'DomainToken.sol' : {content: domain_token_contract_source},
// 		},
// 		settings: {
// 			outputSelection: {
// 				'*': {
// 					'*': [ '*' ]
// 				}
// 			}
// 		}
// 	}


// 	let domain_token_contract_output = JSON.parse(solc.compile(JSON.stringify(domain_token_input)))
// 	let domain_token_contract_abi = domain_token_contract_output.contracts['DomainToken.sol']['DomainToken'].abi
// 	let domain_token_contract_bytecode = '0x' + domain_token_contract_output.contracts['DomainToken.sol']['DomainToken'].evm.bytecode.object
// 	let domain_token_contract = new web3.eth.Contract(domain_token_contract_abi)


	
// 	web3.eth.getAccounts((err, accounts) => {
// 		if(!err) {
// 			web3.eth.defaultAccount = accounts[0]
// 			domain_token_contract.deploy({
// 				data: domain_token_contract_bytecode,
// 				arguments: [] //pass into constructor
// 			})
// 			.send({
// 				from: web3.eth.defaultAccount,
// 				gas: 6000000
// 			}, (err, txhash) => {
// 				if(err) {
// 					console.log('deploy domain token contract callback error', err)
// 				}
// 			})
// 			.on('receipt', receipt => {
// 				domain_token_contract_address = receipt.contractAddress
// 				console.log('token contract address:', domain_token_contract_address)
// 				export_domain_token_contract_info(domain_token_contract_abi, domain_token_contract_address)
// 				process.exit()
// 			})
// 		}
// 		else {
// 			console.log('Cannot get account 0, deploy contract failed!')
// 			process.exit()
// 		}
// 	})
// }


// if (contract == 'ddns') {
// 	let ddns_input = {
// 		language: 'Solidity',
// 		sources: {
// 			'Token.sol' : {content: token_contract_source},
// 			'DomainToken.sol' : {content: domain_token_contract_source},
// 			'DDNS.sol' : {content: ddns_contract_source}
// 		},
// 		settings: {
// 			outputSelection: {
// 				'*': {
// 					'*': [ '*' ]
// 				}
// 			}
// 		}
// 	}

// 	let ddns_contract_output = JSON.parse(solc.compile(JSON.stringify(ddns_input)))
// 	let ddns_contract_abi = ddns_contract_output.contracts['DDNS.sol']['DDNS'].abi
// 	let ddns_contract_bytecode = '0x' + ddns_contract_output.contracts['DDNS.sol']['DDNS'].evm.bytecode.object
// 	let ddns_contract = new web3.eth.Contract(ddns_contract_abi)

// 	let domain_token_contract_info = JSON.parse(fs.readFileSync('../smart-contract/contract_info.json', 'utf8'))
// 	let domain_token_contract_address = domain_token_contract_info['domain_token_contract_address']
// 	let domain_token_contract_abi = domain_token_contract_info['domain_token_contract_abi']

// 	web3.eth.getAccounts((err, accounts) => {
// 		if(!err) {
// 			web3.eth.defaultAccount = accounts[0]
// 			ddns_contract.deploy({
// 				data: ddns_contract_bytecode,
// 				arguments: [domain_token_contract_address]
// 			})
// 			.send({
// 				from: web3.eth.defaultAccount,
// 				gas: 6000000
// 			}, (err, txhash) => {
// 				if(err) {
// 					console.log('deploy ddns contract callback error', err)
// 				}
// 			})
// 			.on('receipt', receipt => {
// 				ddns_contract_address = receipt.contractAddress
// 				console.log('ddns contract address:', ddns_contract_address)
// 				export_contract_info(domain_token_contract_abi, domain_token_contract_address, ddns_contract_abi, ddns_contract_address)
// 				process.exit()
// 			})
// 		}
// 		else {
// 			console.log('Cannot get account 0, deploy contract failed!')
// 			process.exit()
// 		}
// 	})
// }








// // web3.eth.getAccounts((err, accounts) => {
// // 	if(!err) {
// // 		web3.eth.defaultAccount = accounts[0]
// // 		domain_token_contract.deploy({
// // 			data: domain_token_contract_bytecode,
// // 			arguments: [] //pass into constructor
// // 		})
// // 		.send({
// // 			from: web3.eth.defaultAccount,
// // 			gas: 6000000
// // 		}, (err, txhash) => {
// // 			if(err) {
// // 				console.log('deploy domain token contract callback error', err)
// // 			}
// // 		})
// // 		.on('receipt', receipt => {
// // 			domain_token_contract_address = receipt.contractAddress
// // 			console.log('token contract address:', domain_token_contract_address)
// // 			ddns_contract.deploy({
// // 				data: ddns_contract_bytecode,
// // 				arguments: [domain_token_contract_address]
// // 			})
// // 			.send({
// // 				from: web3.eth.defaultAccount,
// // 				gas: 6000000
// // 			}, (err, txhash) => {
// // 				if(err) {
// // 					console.log('deploy ddns contract callback error', err)
// // 				}
// // 			})
// // 			.on('receipt', receipt => {
// // 				ddns_contract_address = receipt.contractAddress
// // 				console.log('ddns contract address:', ddns_contract_address)
// // 				export_contract_info(domain_token_contract_abi, domain_token_contract_address, ddns_contract_abi, ddns_contract_address)
// // 				process.exit()
// // 			})
// // 			.on('error', (err) => {
// // 				console.log('deploy ddns error:', err)
// // 			})
// // 		})
// // 		.on('error', (err) => {
// // 			console.log('deploy token error:', err)
// // 		})
// // 	}
// // 	else {
// // 		console.log('Cannot get account 0, deploy contract failed!')
// // 		process.exit()
// // 	}
// // })



// function export_domain_token_contract_info(domain_token_contract_abi, domain_token_contract_address) {
// 	let data = JSON.stringify({
// 		domain_token_contract_abi : domain_token_contract_abi,
// 		domain_token_contract_address : domain_token_contract_address,
// 	}, null, '\t')

// 	fs.writeFileSync('../smart-contract/contract_info.json', data)
// }



// function export_contract_info(domain_token_contract_abi, domain_token_contract_address, ddns_contract_abi, ddns_contract_address) {
// 	let data = JSON.stringify({
// 		domain_token_contract_abi : domain_token_contract_abi,
// 		domain_token_contract_address : domain_token_contract_address,
// 		ddns_contract_abi : ddns_contract_abi,
// 		ddns_contract_address : ddns_contract_address
// 	}, null, '\t')

// 	fs.writeFileSync('../smart-contract/contract_info.json', data)
// }



