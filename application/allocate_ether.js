const Web3 = require('web3')
const web3 = new Web3('ws://127.0.0.1:8546')
const BN = web3.utils.BN;
const threshold = web3.utils.toBN('200000000000000000')
const max = web3.utils.toBN('500000000000000000')

let counter = 0
let need_update_accounts = []
let main_account
web3.eth.getAccounts((err, accounts) => {
	if(!err) {
		main_account = accounts[0]
		accounts.forEach((account) => {
			web3.eth.getBalance(account)
			.then((value) => {
				value = web3.utils.toBN(value)
				if (value.lt(threshold)) {
					need_update_accounts.push({account: account, ether: max.sub(value)})
				}
				counter += 1
			})
		})
		var timer = setInterval(() => {
			if(counter == accounts.length) {
				// console.log('update pipe:', counter, 'accounts')
				counter = 0
				allocate(need_update_accounts)
				clearInterval(timer)
			}
			// console.log('update pipe:', counter, 'accounts')
		}, 3000)
	}
	else {
		console.log(err)
	}
})



function allocate(need_update_accounts) {
	need_update_accounts.forEach((account) => {
		web3.eth.sendTransaction({
			from: main_account,
			to: account.account,
			value: account.ether.toString()
		})
		.then((receipt) => {
			counter += 1
		})
	})

	setInterval(() => {
		if(counter == need_update_accounts.length) {
			console.log('updated', counter, 'accounts')
			process.exit()
		}
		console.log('updated', counter, 'accounts')
	}, 10000)

}