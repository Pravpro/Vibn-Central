// Load all packages
const dotenv 		= require('dotenv').config(),
	  express		= require('express'),
	  session		= require('express-session'),
	  crypto 		= require('crypto'),
	  querystring 	= require('querystring'),
	  axios 		= require('axios'),
	  bodyParser 	= require('body-parser'),
	  path			= require('path'),
	  mongoose		= require('mongoose'),
	  Account 		= require("./models/account");

const app = express();
const { encrypt, decrypt } = require('./helpers/crypto');
const { PORT = 3000, NODE_ENV = 'prod', DB_USER, DB_PASSWORD, DB_NAME } = process.env;

// Connect to DB
mongoose.connect(`mongodb+srv://${DB_USER}:${DB_PASSWORD}@cluster0.ymgd0.mongodb.net/${DB_NAME}?retryWrites=true&w=majority`, {
	useNewUrlParser: true, 
	useUnifiedTopology: true 
})
.then(() => console.log("Connected to DB!"))
.catch(err => console.log(err));

// Set up App
app.set("view engine", "ejs");
app.use(express.static(`${__dirname}/public`));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
// Session Management
app.use(session({
	name: "sid",
	secret: "Creating Products really fast is key!",
	resave: false,
	saveUninitialized: false,
	cookie: {
		samesite: true, // To prevent CSRF
		secure: NODE_ENV === 'prod'
	}
}));

// Requiring Routes
const authenticationRoutes 	= require(path.resolve('./', path.join('routes', 'authentication')));
app.use('/shopify', authenticationRoutes);

app.get('/', (req, res) => {
	console.log(req.session);
	res.render('index', {shop: req.session.shop});
});

// Show login page
app.get('/login', (req, res) => {
	res.render('login');
});
app.get('/logout', (req, res) => {
	delete req.session.shop;
	res.redirect('/')
})

app.get('/batch/new', isLoggedIn, async (req, res) => {
	try {
		// Get locations
		let data = {
			query: `
				query {
				  locations (first: 20) { 
				    edges {
				      node {
				        id
				        name
				      }
				    } 
				  } 
				}
			`
		}
		let response = await makeApiCall(req.session.shop, data);
		
		// Render new batch page
		res.render('batch/new', {shop: req.session.shop, locations: response.data.data.locations});
	
	} catch(e) {
		console.log(e);
	}
});

app.post('/batch/product/new', isLoggedIn, async (req, res) => {
	console.log(req.body.title);
	try {
		/* Create Product
		 *	Input: title, description
		 *	Output: id
		 */
		let data = {
			query: `
				mutation {
				  productCreate(
				  	input: { 
				  	  title: "${req.body.title}", 
				  	  descriptionHtml: "${req.body.description}" 
				  	}
				  )
				  {
				    product {
				      id
				    }
				    userErrors {
				      field
				      message
				    }
				  }
				}
			`
		}
		let response = await makeApiCall(req.session.shop, data);
		console.log(response.data.data);
		
		/* Set additional parameters on the product
		 *	Input: Inventory (prod id, location id, quantity)
		 */
		let id = response.data.data.productCreate.product.id;
		// Set 
		let quantityRes = await Promise.all( Object.keys(req.body.quantity).map( async location => {
			data = {
				query: `
					mutation {
					  inventoryActivate(
					  	inventoryItemId: "${id}", 
					  	locationId: "${location}", 
					  	available: ${req.body.quantity[location]}
					  ) 
					  {
					  	inventoryLevel{
					  	  available
					  	}
					  	userErrors {
					      field
					      message
					    }
					  }
					}
				`
			}
			let qtyRes = await makeApiCall(req.session.shop, data);
			console.log(qtyRes.data);
			return qtyRes.data;
		}));
		res.send("Success");
	} catch(e) {
		console.log(e);
	}
});


function isLoggedIn(req, res, next) {
	if(req.session.shop) {
		return next();
	}
	res.redirect('/login');
}

async function makeApiCall(shop, data) {
	try {
		// Get AccessToken for shop
		const foundShop = await Account.find({ shop: shop });
		if (foundShop.length == 0 ) {throw "ERR: Can't find the shop in Accounts."}

		let config = {
			headers: {
				'X-Shopify-Access-Token': decrypt(foundShop[0].accessToken)
			}
		}

		// Make request
		let response = await axios.post(`https://${shop}/admin/api/2021-01/graphql.json`, data, config)
		return response;
	} catch(e) {
		throw e;
	}
}


app.listen(PORT, () => {
	console.log(`Product Uploader App listening on port ${PORT}!`);
});