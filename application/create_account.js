const keythereum = require("keythereum");


const account_num = process.argv[2]

function create_account(passwd) {
	let dk = keythereum.create()
	let keyObject = keythereum.dump(passwd, dk.privateKey, dk.salt, dk.iv)
	keythereum.exportToFile(keyObject);
}


const passwd = '123456789a'
for (let i = 0; i < account_num; i++) {
	create_account(passwd)
}