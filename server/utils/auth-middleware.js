module.exports.AuthUser = function (req, res, next) {
	if (req.isAuthenticated()) {
		return next();
	}
	res.redirect('/sign-in');
}