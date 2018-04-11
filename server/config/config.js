var env = process.env.node_env || 'development';

if (env == 'development' || env == 'test') {
	var config = require("./config.json");
	var envConfig = config[env];

	Object.keys(envConfig).forEach((key) => {
		process.env[key] = envConfig[key];
	});
}