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
      Account 				= require("./models/account"),
      formidableMiddleware 	= require('express-formidable'),
      createCsvWriter       = require('csv-writer').createArrayCsvWriter;

const app = express();
const { encrypt, decrypt } = require('./helpers/crypto');
const { PORT = 3000, NODE_ENV = 'prod', DB_USER, DB_PASSWORD, DB_NAME } = process.env;
const fileUploadFolder = 'tmp_image_uploads';
const fileUploadDirPath = `${__dirname}/public/${fileUploadFolder}`;
const currencySymbols = {
    CAD : '$',
    USD : '$'
}
const paymentMethods = {
    shopify_payments : 'CC',
    sezzle : 'Sezzle',
    paypal : 'PayPal'
}

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
    res.redirect('/');
});

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

app.get('/orders', isLoggedIn, (req, res) => {
    res.render('orders');
});
         
app.post('/orders', isLoggedIn, async (req, res) => {
    console.log(req.fields.timeZone);
    // Define after for pagination purposes
    let response = await getOrders(req.session.shop, req.fields.start, req.fields.end, null);
    let ordersData = response.data.data.orders.edges;

    // Create the CSV
    const csvWriter = createCsvWriter({
        header: ['Date', 'Product Name', 'Customer', 'Address', 'Payment Method', 'Sale Price'],
        path: `order-exports/${req.session.shop}.csv`
    });

    let records = [];
    for(let i = 0; i < ordersData.length; i++){
        let order = ordersData[i].node;
        // Field Vars
        let dateString = '',
            customerName = '',
            address = '',
            paymentMethod = '',
            salePrice = '',
            salesTax = '';
        
        // Date field
        if(order.createdAt) {
            dateString = new Date(order.createdAt).toLocaleDateString("en-US", {timeZone: req.fields.timeZone});   
        }

        if(order.shippingAddress){
            // Customer Field
            if(order.shippingAddress.firstName) customerName += order.shippingAddress.firstName;
            if(order.shippingAddress.lastName) customerName += ` ${order.shippingAddress.lastName}`;
            // Address Field
            if(order.shippingAddress.address1) address += `${order.shippingAddress.address1}`;
            if(order.shippingAddress.address2) address += `\n${order.shippingAddress.address2}`;
            if(order.shippingAddress.city) address += `\n${order.shippingAddress.city} ${order.shippingAddress.provinceCode} ${order.shippingAddress.zip}`;
            if(order.shippingAddress.country) address += `\n${order.shippingAddress.country}`;
        }
        // Payment Method
        if(order.paymentGatewayNames.length) paymentMethod += `${paymentMethods[order.paymentGatewayNames[0]] ? paymentMethods[order.paymentGatewayNames[0]] : order.paymentGatewayNames[0]}`

        // Sale Price Field
        if(order.totalPriceSet) salePrice = `${currencySymbols[order.totalPriceSet.shopMoney.currencyCode]}${order.totalPriceSet.shopMoney.amount - order.totalTaxSet.shopMoney.amount}`;
        
        // Create a record for each product in the order
        for(let j = 0; j < order.lineItems.edges.length; j++){
            let product = order.lineItems.edges[j].node;
            // Create record and only put salePrice and tax on first item
            records.push([dateString, product.name, customerName, address, (j ? '' : paymentMethod), (j ? '' : salePrice)]);
        }

    }
    
    csvWriter.writeRecords(records)       // returns a promise
    .then(() => {
        console.log('...Done');
        switch (req.accepts(['html', 'json'])) { //possible response types, in order of preference
            case 'html':
                res.redirect("/orders/export");
                break;
            case 'json':
                res.send({redirect: "/orders/export"});
                break;
        }
    })
    .catch(e => {
        console.log(e);
        res.status(500).send("Failed to write to CSV.")
    } );

});

app.get('/orders/export', isLoggedIn, (req, res) => {
    // Get the CSV file for that shop
    res.download(path.join(__dirname, `order-exports/${req.session.shop}.csv`));

    // Maybe delete file after
});

// TODO: Move these functions out to a helper file.
// ================================== HELPER FUNCTIONS ==================================

// Recursively receive all the orders
async function getOrders(shop, startTime, endTime, after){
    console.log("Iterate");
    data = {
        query: `
            query {
              orders(first: 10, ${after ? `after:"${after}", `: ''}query:"created_at:>=${startTime} created_at:<=${endTime}") {
                edges {
                  node {
                    createdAt
                    lineItems(first:50) {
                      edges {
                        node {
                          name
                        }
                      }
                    }
                    shippingAddress {
                      firstName
                      lastName
                      address1
                      address2
                      city
                      provinceCode
                      zip
                      country
                    }
                    paymentGatewayNames
                    totalPriceSet{
                      shopMoney{
                        amount
                        currencyCode
                      }
                    }
                    totalTaxSet{
                      shopMoney{
                        amount
                      }
                    }
                  }
                  cursor
                }
                pageInfo {
                  hasNextPage
                }
              }
            }
        `
    }
    try{
        let response = await makeApiCall(shop, data);
        if(response.data.errors) console.log(response.data.errors);
        if(response.data.data.orders.pageInfo.hasNextPage) {
            // Recursive Case
            let after = response.data.data.orders.edges[response.data.data.orders.edges.length-1].cursor;
            let nextRes = await getOrders(shop, startTime, endTime, after);
            nextRes.data.data.orders.edges.forEach((edge) => {
                response.data.data.orders.edges.push(edge);
            });
        }
        // Base Case
        return response;
    }
    catch(e){ 
        throw e;
    }
}

function isLoggedIn(req, res, next) {
    if(req.session.shop) {
        return next();
    }
    switch (req.accepts(['html', 'json'])) { //possible response types, in order of preference
        case 'html':
            res.redirect("/login");
            break;
        case 'json':
            res.send({redirect: "/login"});
            break;
        default:
            // if the application requested something we can't support
            res.status(400).send('Bad Request');
            return;
    }
}

// Make API call with given data and return the response
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