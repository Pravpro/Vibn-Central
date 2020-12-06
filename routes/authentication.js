const express 		= require("express"),
	  router = express.Router(),
	  cookie 		= require('cookie'),
	  ShopifyToken 	= require('shopify-token'),
	  axios 		= require('axios');


// Important Variables for Authentication
const apiKey = process.env.APP_API_KEY;
const apiSecret = process.env.APP_API_SECRET;
const scopes = 'write_products';
const forwardingAddress = "https://1fd2517eefb2.ngrok.io";

const shopifyToken = new ShopifyToken({
  sharedSecret: apiSecret,
  redirectUri: `${forwardingAddress}/shopify/callback`,
  apiKey: apiKey
});

// =====================
// CAMPGROUND ROUTES
// =====================

// Handle install request for app
router.get('/', (req, res) => {
	const shop = req.query.shop;
	
	// Request must be from a shop
	if(!shop) { return res.status(400).send('Missing shop parameter. Please add ?shop=your-development-shop.myshopify.com to your request'); }

	const state = shopifyToken.generateNonce(); // Basically to generate a random string that Shopify can echo so app can validate the req
	
	//following builds this url: `https://${shop}/admin/oauth/authorize?client_id=${apiKey}&scope=${scopes}&state=${state}&redirect_uri=${redirectUri}`;
	const installUri = shopifyToken.generateAuthUrl(shop, scopes, state);

	res.cookie('state', state);
	res.redirect(installUri)
});

// Get Access Token from Shopify for API calls
router.get('/callback', async (req, res) => {
	const { shop, hmac, code, state } = req.query;
	const stateCookie = cookie.parse(req.headers.cookie).state;

	// Verify states
	if(state !== stateCookie) { return res.status(403).send('Request origin cannot be verified'); }

	// Verify required parameters are present
	if(!shop || !hmac || !code) { res.status(400).send('Required parameters missing'); }

	// Validate hmac by calculating signature
	let hmacVerified = shopifyToken.verifyHmac(req.query);
    console.log(`verifying -> ${hmacVerified}`);
    // DONE: Validate request is from Shopify
    if (!hmacVerified) { return res.status(400).send('HMAC validation failed'); }

    // Create request for access token
	const accessTokenRequestUrl = 'https://' + shop + '/admin/oauth/access_token';
	const accessTokenPayload = {
	  client_id: apiKey,
	  client_secret: apiSecret,
	  code,
	};

	// Send request for access token
	axios.post(accessTokenRequestUrl, accessTokenPayload)
	.then(async(accessTokenResponse) => {

	  	const accessToken = accessTokenResponse.data.access_token;
	   	const shopRequestUrl = 'https://' + shop + '/admin/api/2020-10/shop.json';
		const shopRequestHeaders = {
			'X-Shopify-Access-Token': accessToken
		};

		axios.get(shopRequestUrl, { headers: shopRequestHeaders })
		.then((shopResponse) => {
			res.end(JSON.stringify(shopResponse.data));
		})
		.catch((err) => {
			res.send(err);
		});


	})
	.catch((err) => {
	  	res.send(`${err.name}: ${err.message}`);
	});

});

module.exports = router;