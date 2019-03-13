const Web3 = require('web3')
const web3 = new Web3('ws://127.0.0.1:8546')



const passwd = '123456789a'
const duration = 0
let counter = 0
web3.eth.getAccounts((err, accounts) => {
	if(!err) {
		accounts.forEach((account) => {
			web3.eth.personal.unlockAccount(account, passwd, duration, (err, unlocked) => {
				if (unlocked) {
					counter += 1
				}
			})
		})
		setInterval(() => {
			if(counter == accounts.length) {
				process.exit()
			}
			console.log('unlocked', counter, 'accounts')
		}, 3000)
	}
	else {
		console.log(err)
	}
})