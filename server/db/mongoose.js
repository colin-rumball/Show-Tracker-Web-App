var mongoose = require('mongoose');

mongoose.Promise = global.Promise;
mongoose.connect(process.env.MONGODB_URI)
.then((data) => {
	// console.log(data);
}).catch((err) => {
	console.error(err);
});

module.exports = {
    mongoose
};