// Load all packages
const dotenv 		= require('dotenv').config(),
	  express		= require('express'),
	  app 			= express(),
	  crypto 		= require('crypto'),
	  querystring 	= require('querystring'),
	  axios 		= require('axios'),
	  path			= require('path');

// Requiring Routes
const authenticationRoutes 	= require(path.resolve('./', path.join('routes', 'authentication')));
const { PORT = 3000 } = process.env;

app.set("view engine", "ejs");
app.use(express.static(`${__dirname}/public`));

// Use all routes
app.use('/shopify', authenticationRoutes);

app.get('/', (req, res) => {
	res.render('index');
});

// Show login page
app.get('/login', (req, res) => {
	res.render('login');
})

app.listen(PORT, () => {
	console.log(`Product Uploader App listening on port ${PORT}!`);
});