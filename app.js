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

// app.get('/batch', isLoggedIn, (req, res) => {
// 	res.render('batch/index');
// });

app.get('/batch/new', isLoggedIn, (req, res) => {
	res.render('batch/new', {shop: req.session.shop});
});

app.get('/queryTest', isLoggedIn, async (req, res) => {
	try {
		let data = {
			query: `
				query {
				  product(id: "gid://shopify/Product/5890569306269") {
				    id
				    title
				    descriptionHtml
				  }
				}
			`
		}
		let response = await makeApiCall(req.session.shop, data);
		console.log(response.data);
		
	} catch(err) {
		console.log(err);
	}
})

app.post('/batch/product/new', isLoggedIn, async (req, res) => {
	console.log(req.body.title);
	res.send("Success");
	try {
		let data = {
			query: `
				mutation {
				  productCreate(input: { title: "${req.body.title}" }){
				    product {
				      id
				    }
				  }
				}
			`
		}
		let response = await makeApiCall(req.session.shop, data);
		console.log(response.data);
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