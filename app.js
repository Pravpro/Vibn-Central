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


const port = process.env.PORT || 3000;
app.listen(port, () => {
	console.log(`Product Uploader App listening on port ${port}!`);
});