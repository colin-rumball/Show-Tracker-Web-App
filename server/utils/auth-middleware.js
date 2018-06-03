module.exports.AuthUser = function (req, res, next) {
	if (req.isAuthenticated() || process.env.node_env != "production") {
		return next();
	}
	res.redirect('/sign-in');
}