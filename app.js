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


// Use all routes
app.use('/shopify', authenticationRoutes);

app.get('/', (req, res) => {
	res.send('Please add shopify?shop=your-shop-name to your request');
});


const port = process.env.PORT || 3000;
app.listen(port, () => {
	console.log(`Product Uploader App listening on port ${port}!`);
});