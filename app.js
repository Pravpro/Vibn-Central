// Load all packages
const dotenv 		= require('dotenv').config(),
	  express		= require('express'),
	  session		= require('express-session'),
	  crypto 		= require('crypto'),
	  querystring 	= require('querystring'),
	  axios 		= require('axios'),
	  path			= require('path');

const app = express();
const { PORT = 3000, NODE_ENV = 'prod' } = process.env;

app.set("view engine", "ejs");
app.use(express.static(`${__dirname}/public`));
app.use(session({
	name: "sid",
	secret: "Creating Products really fast is key!",
	resave: false,
	saveUninitialized: false,
	cookie: {
		samesite: true, // To prevent CSRF
		secure: NODE_ENV === 'prod'
	}
}))

// Requiring Routes
const authenticationRoutes 	= require(path.resolve('./', path.join('routes', 'authentication')));
app.use('/shopify', authenticationRoutes);

app.get('/', (req, res) => {
	console.log(req.session);
	res.render('index');
});

// Show login page
app.get('/login', (req, res) => {
	res.render('login');
})

app.listen(PORT, () => {
	console.log(`Product Uploader App listening on port ${PORT}!`);
});