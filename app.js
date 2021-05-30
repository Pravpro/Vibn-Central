// Load all packages
const dotenv 				= require('dotenv').config(),
	  fs 					= require('fs'),
	  express				= require('express'),
	  session				= require('express-session'),
	  crypto 				= require('crypto'),
	  querystring 			= require('querystring'),
	  axios 				= require('axios'),
	  path					= require('path'),
	  mongoose				= require('mongoose'),
	  Account 				= require("./models/account");
	  formidableMiddleware 	= require('express-formidable');

const app = express();
const { encrypt, decrypt } = require('./helpers/crypto');
const { PORT = 3000, NODE_ENV = 'prod', DB_USER, DB_PASSWORD, DB_NAME } = process.env;
const fileUploadFolder = 'tmp_image_uploads';
const fileUploadDirPath = `${__dirname}/public/${fileUploadFolder}`;

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
app.use(formidableMiddleware({
	uploadDir: fileUploadDirPath,
	keepExtensions: true,
	multiples: true
}));
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

// Routes
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

// Get route for batch upload Form
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
		// TODO: Error Handling
		console.log(e);
	}
});

// Post route for uploading a product
app.post('/batch/product/new', isLoggedIn, async (req, res) => {
	try {
		let baseImageURL = `https://${req.headers.host}/${fileUploadFolder}`;
		
		// Rename the files to original names and modify path to reflect this
		if(!Array.isArray(req.files.images)) req.files.images = [req.files.images];
		await Promise.all(req.files.images.map( async image => {
			let newPath = `${fileUploadDirPath}/${image.name}`
			await fs.rename(image.path, newPath, async () => {
				image.path = newPath;
			});
		}));
		
		// Build 'CreateMediaInput' list
		let imageList = '[';
		for(let i = 0; i < req.files.images.length; i++) {
			if(i > 0) { imageList += ','}
			let encodedImageURL = encodeURI(`${baseImageURL}/${req.files.images[i].name}`);
			imageList += `{
				originalSource: "${encodedImageURL}", 
				mediaContentType: IMAGE
			}`
		}
		imageList += ']';
		console.log(`[CreateMediaInput]: ${imageList}`);

		/* Create Product
		 *	Input: title, description, images
		 *	Output: id
		 */
		let data = {
			query: `
				mutation {
				  productCreate(
				  	input: { 
				  	  title: "${req.fields.title}", 
				  	  descriptionHtml: "${req.fields.description}"
				  	},
					media: ${imageList}
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
		console.log(JSON.stringify(response.data.data));
		// let id = response.data.data.productCreate.product.id;
		
		// TODO: Do proper error handling
		if(response.data.data.productCreate.userErrors.length > 0) console.log(response.data.data.productCreate.userErrors.message);
		

		// Delete Images from server after wait time (= 10 seconds * # of images = total wait time)
		// TODO: Figure out if there is a better method for when to delete files 
		setTimeout(() => {
			for(let i = 0; i < req.files.images.length; i++) {
				fs.unlink(req.files.images[i].path, err => {
					if(err){
						console.log(err);
						return
					}
				});
			}
		}, req.files.images.length*10000);

		/* Set additional parameters on the product
		 *	Input: Inventory (prod id, location id, quantity)
		 */
		// let id = response.data.data.productCreate.product.id;
		// TODO: Set Inventory
		// let quantityRes = await Promise.all( Object.keys(req.fields.quantity).map( async location => {
		// 	data = {
		// 		query: `
		// 			mutation {
		// 			  inventoryActivate(
		// 			  	inventoryItemId: "${id}", 
		// 			  	locationId: "${location}", 
		// 			  	available: ${req.fields.quantity[location]}
		// 			  ) 
		// 			  {
		// 			  	inventoryLevel{
		// 			  	  available
		// 			  	}
		// 			  	userErrors {
		// 			      field
		// 			      message
		// 			    }
		// 			  }
		// 			}
		// 		`
		// 	}
		// 	let qtyRes = await makeApiCall(req.session.shop, data);
		// 	console.log(qtyRes.data);
		// 	return qtyRes.data;
		// }));
		res.send("Success");
	} catch(e) {
		console.log(e);
	}
});

// TODO: Move these functions out to a helper file.
// ================================== HELPER FUNCTIONS ==================================
// TODO: Make this function recognize type of request
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
		let response = await axios.post(`https://${shop}/admin/api/2021-04/graphql.json`, data, config)
		return response;
	} catch(e) {
		throw e;
	}
}

// START APP
app.listen(PORT, () => {
	console.log(`Product Uploader App listening on port ${PORT}!`);
});