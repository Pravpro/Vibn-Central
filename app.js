// Load all packages
const dotenv 				= require('dotenv').config(),
      fs 					= require('fs'),
      express				= require('express'),
      methodOverride        = require('method-override'),
      session				= require('express-session'),
      axios 				= require('axios'),
      path					= require('path'),
      mongoose				= require('mongoose'),
      Account 				= require("./models/account"),
      formidableMiddleware 	= require('express-formidable'),
      createCsvWriter       = require('csv-writer').createArrayCsvWriter,
      readline              = require('readline'),
      nodemailer            = require("nodemailer");

const app = express();
const { constants } = require('buffer');
const { encrypt, decrypt } = require('./helpers/crypto');
const { Console } = require('console');
const { json } = require('body-parser');
const { PORT = 3000, NODE_ENV = 'prod', DB_USER, DB_PASSWORD, DB_NAME, FORWARDING_ADDRESS, NODEMAILER_SERVICE, NODEMAILER_EMAIL, NODEMAILER_EMAIL_KEY } = process.env;

// Order feature variables
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
const ORDERS_EXPORT_DIR = './order-exports';
const SEQUENCE_NUM_TYPE = 'seqNum';
const transporter = nodemailer.createTransport({
    service: NODEMAILER_SERVICE,
    auth: {
      user: NODEMAILER_EMAIL,
      pass: NODEMAILER_EMAIL_KEY
    }
});

// Connect to DB
mongoose.connect(`mongodb+srv://${DB_USER}:${DB_PASSWORD}@cluster0.ymgd0.mongodb.net/${DB_NAME}?retryWrites=true&w=majority`, {
    useNewUrlParser: true, 
    useUnifiedTopology: true 
})
.then(() => console.log("Connected to DB!"))
.catch(err => console.log(err));

// Set up App
app.set("view engine", "ejs");
app.use(methodOverride('_method'));
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
    res.render('login', {shop: req.session.shop});
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

app.get('/orders', isLoggedIn, async (req, res) => {
    try{
        let accounts = await Account.find({shop: req.session.shop});
        let account = accounts.length ? accounts[0] : null;

        // Get Collections data from store
        let response = await getCollections(req.session.shop, null);
        let collections = [];
        response.data.data.collections.edges.forEach(collectionEdge => {
            collections.push({
                id: collectionEdge.node.id,
                title: collectionEdge.node.title,
                productsCount: collectionEdge.node.productsCount,
            });
        });

        // Prep renderOptions for the page
        let renderOptions = {shop: req.session.shop, collections: collections}
        if(account && account.storeProperties) for(let [key, value] of account.storeProperties) renderOptions[key] = value;
        // Render Order page
        res.render('orders', renderOptions);
    }
    catch(e){
        console.error(e);
        res.status(400).send(e);
    }
});

// Create a bulk data orders request to Shopify for the specified date range
app.post('/orders', isLoggedIn, async (req, res) => {
    let error = await getOrdersv2(req.session.shop, req.fields.start, req.fields.end, req.fields.collectionId);
    if(error) res.status(404).send();
    else res.status(200).send();
    console.log('Order Request sent');
});

// This route is used to handle webhook payload from the bulk_operations/finish topic. This callback handles the creation of the export file
app.post('/orders/export', async (req, res) => {
    res.status(200).send('Status: OK');
    console.log('bulk_operations/finish Webhook returned:');
    console.log(req.fields);

    // Query for getting the file url from the completed bulk operation
    data = {
        query: `
          query {
            node(id: "${req.fields.admin_graphql_api_id}") {
              ... on BulkOperation {
                url
                partialDataUrl
              }
            }
          }
        `
    }

    try{
        // TODO: Error Handling if no Account returned
        let accounts = await Account.find({shop: req.headers['x-shopify-shop-domain']});
        let account = accounts.length ? accounts[0] : null;
        
        let bulkOpRes = await makeApiCall(req.headers['x-shopify-shop-domain'], data);
    
        // Retrieve the JSONL file of orders if a valid URL was returned
        // TODO: Error Handling if no URL
        if(bulkOpRes.data.data.node.url){
            let ordersRes = await axios.get(bulkOpRes.data.data.node.url, {
                responseType: 'stream'
            });
            
            // TODO: Error Handling if not status 200
            if(ordersRes.status == 200){

                const rl = readline.createInterface({
                    input: ordersRes.data
                });

                // Build the records for writing to the csv file    
                if(!fs.existsSync(ORDERS_EXPORT_DIR)) fs.mkdirSync(ORDERS_EXPORT_DIR);
    
                // Create the CSV writer
                const csvWriter = createCsvWriter({
                    header: ['Date', 'Product ID', 'Product Name', 'Customer', 'Address', 'Cost of Good', 'Payment Method', 'Sale Price'],
                    path: `${ORDERS_EXPORT_DIR}/${req.headers['x-shopify-shop-domain']}.csv`
                });
    
                let records = [];
                let currentOrder = null;

                // Build the records to write to CSV file
                for await (const line of rl){
                    let jsonObj = JSON.parse(line);
                    // BASE CASE: Current Order is null when loop begins. Set currentOrder to the order JSON object line that comes in and continue.
                    if(!currentOrder){
                        currentOrder = jsonObj;
                        continue;
                    }
                    // CASE: The JSON object represents a Order Line Item. Add line item to list of line items of current order only if it is part of specified collection.
                    else if(jsonObj.__parentId){
                        if('product' in jsonObj){
                            if(jsonObj.product?.inCollection) currentOrder.lineItems ? currentOrder.lineItems.push(jsonObj) : currentOrder.lineItems = [jsonObj]
                        } else {
                            currentOrder.lineItems ? currentOrder.lineItems.push(jsonObj) : currentOrder.lineItems = [jsonObj];
                        }
                        continue;
                    }
                    // CASE: currentOrder now represents a complete order with all LineItems and is ready to be created as a record for the orders CSV. 
                    //  Only process if there are Line Items.
                    if(currentOrder.lineItems && currentOrder.lineItems.length){
                        records.push(...createOrderRecords(currentOrder, account.storeProperties.timeZone));
                    }

                    // Set Current Order with next order.
                    currentOrder = jsonObj;
                }

                // Process last order
                if(currentOrder.lineItems && currentOrder.lineItems.length){
                    records.push(...createOrderRecords(currentOrder, account.storeProperties.timeZone));
                }
    
                // Write records to a csv file
                await csvWriter.writeRecords(records);
                
                // Send file to the email specified
                let today = new Date();
                await transporter.sendMail({
                    from: NODEMAILER_EMAIL,
                    to: account.storeProperties.get('email'),
                    subject: 'Order Export',
                    text: 'Successfully Exported Orders',
                    attachments:[
                        {
                            filename: `Orders-Export_${today.getFullYear()}-${today.getMonth()+1}-${today.getDate()}.csv`,
                            path: `${ORDERS_EXPORT_DIR}/${req.headers['x-shopify-shop-domain']}.csv`
                        }
                    ]
                });
                console.log('Email sent');
                // console.log(info);

            }
        }
    } catch(e){
        console.log(e);
    }

});

app.get('/settings', isLoggedIn, async(req, res) => {
    let accounts = await Account.find({shop: req.session.shop});
    let account = accounts.length ? accounts[0] : null;

    console.log(account);

    renderOptions = account && account.storeProperties ? {shop: req.session.shop, ...Object.fromEntries(account.storeProperties.entries())} : {shop: req.session.shop}

    console.log(renderOptions);

    res.render('settings', renderOptions);
});

app.post('/settings', isLoggedIn, async(req, res) => {
    let accounts = await Account.find({shop: req.session.shop});
    let account = accounts.length ? accounts[0] : null;

    console.log(req.fields);

    account.storeProperties = req.fields;
    await account.save();

    res.status(200).send();
});

// This route will eventually hold the index page for skugen, redirecting to sku route for now
app.get('/skugen/sku', isLoggedIn, async(req, res) => {
    // Get search query
    const searchStr = req.query.search;
    
    // TODO: Create helper function to build table
    // Table Header
    let skuPropsList = Account.schema.obj.skuRecords[0].obj ? Object.keys(Account.schema.obj.skuRecords[0].obj) : [];
    skuPropsList.push('createdDate');
    
    let table = [];
    let row1 = [];
    skuPropsList.forEach(prop => {
        row1.push({ 
            label: prop.charAt(0).toUpperCase() + prop.split(/(?=[A-Z])/).join(' ').slice(1),
            value: '',
            name: prop
        });
    });
    
    table.push(row1);
    
    // Table Data
    let accounts = searchStr ? await getSearchResults(req.session.shop, searchStr) : await Account.find({shop: req.session.shop});
    let account = accounts.length ? accounts[0] : null;
    console.log(account);
    if(account) {

        account.skuRecords.sort((a, b) => {
            return a._id < b._id ? 1 : -1
        });

        let formatter = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'CAD'
        });

        account.skuRecords.forEach(rec => {
            let newRow = [];
            skuPropsList.forEach(prop => {
                let label = rec[prop];
                let value = rec[prop];
                if(prop == 'createdDate'){
                    label = value = rec._id.getTimestamp().toLocaleString();
                } else if (prop == 'costOfGood'){
                    label = formatter.format(rec[prop]).slice(2);
                }
                newRow.push({
                    label: label,
                    value: value,
                    name: prop
                });
            });
            table.push(newRow);
        });

        res.render('skugen', { 
            shop: req.session.shop,
            records: table,
            search: searchStr ? searchStr : '',
            viewState: 'home'
        });
    }
});

// Process the data for creating a sku
app.post('/skugen/sku', isLoggedIn, async(req, res) => {
    console.log(req.fields);

    let accounts = await Account.find({shop: req.session.shop});
    let account = accounts.length ? accounts[0] : null;

    if(!account) res.send({error:'Could not find account'}).status(404);
    else if(!account.skuFormat || !account.skuFormat.length) res.send({error:'Could not find sku format data'}).status(404);
    else {
        let seqNumSeg;
        let skuPrefix = '';
        account.skuFormat.forEach( segment => {
            if(segment.type != SEQUENCE_NUM_TYPE){
                skuPrefix += segment.data.get(req.fields.segments[segment.name]);
            } else seqNumSeg = segment;
        });
        console.log(skuPrefix);
        console.log(seqNumSeg);

        let curCount = account.skuCounter && account.skuCounter.get(skuPrefix) ? account.skuCounter.get(skuPrefix) : parseInt(seqNumSeg.data.get(''))-1;
        let seqNumLength = seqNumSeg.data.get('').length;

        // console.log(curCount);
        // console.log(seqNumLength);

        // Create records array if it doesn't exist (only needed for first time)
        if(!account.skuRecords) account.skuRecords = [];

        generatedSkus = [];
        // Check if enough length of sequence number for generating all sequence numbers
        if((curCount + req.fields.copies).toString().length > seqNumLength) res.send({error:'Sequence Number format is not long enough. Please increase length by editing the SKU format.'}).status(404);
        for(let i = 0; i < req.fields.copies; i++){
            curCount++;
            let sku = skuPrefix + '0'.repeat(seqNumLength - curCount.toString().length) + curCount;
            account.skuRecords.push({ 
                skuNum: sku, 
                ...req.fields.properties
            });
            generatedSkus.push(sku);
        }

        if(!account.skuCounter) account.skuCounter = new Map();
        account.skuCounter.set(skuPrefix, curCount);

        // console.log(account.skuRecords);
        // console.log(account.skuCounter);
        // console.log(generatedSkus);
        await account.save();
        res.send(generatedSkus);

    }
    

    // res.send({error: 'Unknown Server Error'}).status(500);
});

// Render the form to create SKUs
app.get('/skugen/sku/new', isLoggedIn, (req, res) => {
    let skuPropsInputs = [];
    let skuProps = Account.schema.obj.skuRecords[0].obj;

    // Build properties list to help render inputs
    Object.keys(skuProps).filter(prop => prop !== 'skuNum').forEach(prop => {
        skuPropsInputObj = {};
        skuPropsInputObj.name = prop;
        skuPropsInputObj.type = typeof(skuProps[prop]()) == 'number' ? 'number' : 'text';
        skuPropsInputObj.label = prop.charAt(0).toUpperCase() + prop.split(/(?=[A-Z])/).join(' ').slice(1);

        skuPropsInputs.push(skuPropsInputObj);
    });
    renderSkuPage(req, res, { skuProps: skuPropsInputs, viewState: 'skugen'});
});

app.get('/skugen/skuformat', isLoggedIn, async(req, res) => {
    renderSkuPage(req, res, { viewState: 'view'});
});

app.get('/skugen/skuformat/edit', isLoggedIn, async(req, res) => {
    renderSkuPage(req, res, { viewState: 'edit'});
});

// Get the sku segment that corresponds to the id in the request
app.get('/skugen/skuformat/seg/:id', isLoggedIn, async(req, res) => {
    let rObj = await getSegmentById(req.session.shop, req.params.id);
    rObj.segment ? res.send(rObj.segment) : res.status(404);
});

// Update the sku segment that corresponds to the id in the request
app.put('/skugen/skuformat/seg/:id', isLoggedIn, async(req, res) => {
    redirectUrl = '/skugen/skuformat/edit';
    let {account, segment} = await getSegmentById(req.session.shop, req.params.id);
    
    if(!segment){
        redirectUrl = createUrlWithSearchParams(redirectUrl, {
            errTitle: 'Invalid Sku Segment',
            errMsg: 'Could not find segment by Id provided.'
        });
    }
    // Update condition (negative of when not to update); Don't allow update if segment type is being changed to sequence number and is not the last segment
    else if(!(segment.type !== req.fields.skuPartType && req.fields.skuPartType === SEQUENCE_NUM_TYPE && i !== account.skuFormat.length - 1)){
        segment.name = req.fields.skuPartName;
        segment.type = req.fields.skuPartType;
        if(req.fields.skuPartType === SEQUENCE_NUM_TYPE){
            segment.data = { '': req.fields.seqNum };
            // Error: The update path 'skuFormat.2.data.' contains an empty field name, which is not allowed.
            // PICK UP HERE
        } else {
            // Create the new Sku Part
            segment.data = new Map();
            if(Array.isArray(req.fields.key)) for(let i = 0; i < req.fields.key.length; i++) segment.data.set(req.fields.key[i], req.fields.value[i]);
            else segment.data.set(req.fields.key, req.fields.value);
        }
        await account.save();
    } else {
        redirectUrl = createUrlWithSearchParams(redirectUrl, {
            errTitle: 'Invalid Sku format',
            errMsg: 'Sequence number can only be the last segment in the sku format.'
        });
    }
    res.redirect(redirectUrl);
});

// Delete the sku segment that corresponds to the id in the request
app.delete('/skugen/skuformat/seg/:id', isLoggedIn, async(req, res) => {
    let redirectUrl = '/skugen/skuformat/edit';
    let segId = req.params.id;
    let accounts = await Account.find({shop: req.session.shop});
    let account = accounts.length ? accounts[0] : null;
    
    if(account) for(let i = 0; i < account.skuFormat.length; i++) if(account.skuFormat[i]._id == segId) account.skuFormat.splice(i,1);
    await account.save();

    res.redirect(redirectUrl);
});

// Create a new sku segment according to values in req
app.post('/skugen/skuformat/seg', isLoggedIn, async(req, res) => {
    const filter = {shop: req.session.shop};

    let accounts = await Account.find(filter);
    let account = accounts.length ? accounts[0] : null;

    if(account){
        let skuFormat = account.skuFormat;
        let newSkuPart = {
            name: req.fields.skuPartName,
            type: req.fields.skuPartType
        }

        // Case 1: The new sku part being added is a of type tags
        if(req.fields.skuPartType == 'tags'){

            // Create the new Sku Part
            let tagsMap = {};
            if(Array.isArray(req.fields.key)){
                for(let i = 0; i < req.fields.key.length; i++) tagsMap[req.fields.key[i]] = req.fields.value[i];
            } else {
                tagsMap[req.fields.key] = req.fields.value;
            }
            newSkuPart.data = tagsMap;

            // Add Sku part to the skuFormat
            // Check If new sku part is being added to the end
            if(skuFormat.length == req.fields.skuIndex){
                // Check if sequence number part exists, ensure it is always the last part of the sku
                if(skuFormat.length > 0 && skuFormat[skuFormat.length-1].type == SEQUENCE_NUM_TYPE) skuFormat.splice(skuFormat.length-1, 0, newSkuPart);
                else skuFormat.push(newSkuPart);

            } else if(req.fields.skuIndex < skuFormat.length) {
                skuFormat.splice(req.fields.skuIndex, 0, newSkuPart);
            }

            // Insert the updated sku format back to the Db
            await account.save();
            
        } 
        // Case 2: The new sku part being added is a of type seqNum. Insert only if sequece number part does not already exist
        else if(req.fields.skuPartType == SEQUENCE_NUM_TYPE && (skuFormat.length == 0 || skuFormat[skuFormat.length-1].type != SEQUENCE_NUM_TYPE)){ 
            newSkuPart.data = { '': req.fields.seqNum };
            skuFormat.push(newSkuPart);
            await account.save();
        }
        
        // Redirect back to the edit route (so that it re-renders the edit page with new sku format)
        res.redirect('/skugen/skuformat/edit');
    } else {
        // return a 404 page here
    }

});

// TODO: Move these functions out to a helper file.
// ================================== HELPER FUNCTIONS ==================================

// Create a URL with passed in search params
function createUrlWithSearchParams(url, params){
    const qs = Object.keys(params)
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&');
    return `${url}?${qs}`;
}

function createOrderRecords(order, timeZone){
    let records = [];

    // Field Vars
    let dateString = '',
    customerName = '',
    address = '',
    paymentMethod = '',
    salePrice = '',
    salesTax = '';

    // Date field
    if(order.createdAt) {
        dateString = new Date(order.createdAt).toLocaleDateString("en-US", {timeZone: timeZone});   
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
    for(let j = 0; j < order.lineItems.length; j++){
        let product = order.lineItems[j];
        let costOfGood = product.variant && product.variant.inventoryItem && product.variant.inventoryItem.unitCost ? `${currencySymbols[product.variant.inventoryItem.unitCost.currencyCode]}${product.variant.inventoryItem.unitCost.amount}` : '0';
        // Create record and only put salePrice and tax on first item
        records.push([dateString, product.sku, product.name, customerName, address, costOfGood, (j ? '' : paymentMethod), (j ? '' : salePrice)]);
    }

    return records;
}

async function getOrdersv2(shop, startTime, endTime, collectionId){
    // Query String for Orders to be retrieved
    const queryString = `
      {
        orders(query:"created_at:>=${startTime} created_at:<=${endTime}") {
          edges {
            node {
              id
              createdAt
              lineItems {
                edges {
                  node {
                    id
                    name
                    sku
                    ${collectionId ? `product{
                      inCollection(id:"${collectionId}")
                    }` : ''}
                    variant {
                      inventoryItem {
                        unitCost {
                          amount
                          currencyCode
                        }
                      }
                    }
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
          }
        }
      }
    `
    // the bulk query set up for orders
    const data = {
        query: `
          mutation {
            bulkOperationRunQuery(
              query:"""
                ${queryString}
              """
            ) {
              bulkOperation {
                id
                status
              }
              userErrors {
                field
                message
              }
            }
          }
        `
    }

    // Query for subscribing to bulk_operations/finish webhook
    const webhookData = {
        query: `
          mutation {
            webhookSubscriptionCreate(
              topic: BULK_OPERATIONS_FINISH
              webhookSubscription: {
                format: JSON,
                callbackUrl: "${FORWARDING_ADDRESS}/orders/export"}
            ) {
              userErrors {
                field
                message
              }
              webhookSubscription {
                id
              }
            }
          }
        `
    }

    try{
        // Make API callout
        let response = await makeApiCall(shop, data);
        console.log(response.data.data);
        let errors = response.data.data.bulkOperationRunQuery.userErrors;

        if(errors && errors.length > 0) {
            for(let i = 0; i < errors.length; i++) {
                console.error(errors[i].message);
            }
            return errors[0].message;
        }
        else{
            // Subscribe to the bulk_operations/finish webhook topic
            makeApiCall(shop, webhookData);
            return 0;
        }
    } catch(e){
        console.log(e);
    }
}

/**
 * @description Recursively retrieve collections from store.
 * @param shop - name of the shop to get the segment from
 * @param after - Id of the collection after which to get the collections (used for recursive call)
 * @return Response after getting all the collections
 */
async function getCollections(shop, after){
    console.log("Iterate");
    data = {
        query: `
          query {
            collections(first:50${after ? `, after:"${after}", `: ''}){
              edges {
                node {
                  id
                  title
                  productsCount
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
        if(response.data.data.collections.pageInfo.hasNextPage) {
            // Recursive Case
            let after = response.data.data.collections.edges[response.data.data.collections.edges.length-1].cursor;
            let nextRes = await getCollections(shop, after);
            nextRes.data.data.collections.edges.forEach((edge) => {
                response.data.data.collections.edges.push(edge);
            });
        }
        // Base Case
        return response;
    }
    catch(e){ 
        throw e;
    }
}

/**
 * @description get Account with the SkuRecords based on a search query string
 * @param searchStr - name of the shop to get the segment from
 * @return Account mongodb document
 */
async function getSearchResults(shopName, searchStr) {
    return await Account.aggregate(
        [
            { "$match": { "shop": shopName } }, 
            { 
                "$redact": { 
                    "$cond": [
                        { 
                            "$regexMatch": { 
                                input: { 
                                    "$ifNull": [ "$skuNum", searchStr ] 
                                }, 
                                regex: new RegExp(searchStr)
                            }
                        }, 
                        "$$DESCEND", 
                        "$$PRUNE"
                    ]
                }
            }
        ]);
}

/**
 * @description Get the segment from the sku of the account 
 * @param shopName - name of the shop to get the segment from
 * @param segId - ID of the segment to get
 * @return an object with the account and segement retrieved
 */
async function getSegmentById(shopName, segId){
    const filter = {shop: shopName};
    let accounts = await Account.find(filter);
    let account = accounts.length ? accounts[0] : null;
    
    let segment = null;
    if(account) for(let i = 0; i < account.skuFormat.length; i++) if(account.skuFormat[i]._id == segId) segment = account.skuFormat[i];

    return {account, segment};
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
        // console.log(foundShop);
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

// Render the Sku Page according to view state
async function renderSkuPage(req, res, viewVars) {
    let accounts = await Account.find({shop: req.session.shop});
    let account = accounts.length ? accounts[0] : null;
    
    if(account) {
        res.render('skugen', { 
            shop: req.session.shop, 
            skuformat: account.skuFormat,
            ...viewVars
        });
    } else {
        res.status(404);
    }
}

// START APP
app.listen(PORT, () => {
    console.log(`Product Uploader App listening on port ${PORT}!`);
});