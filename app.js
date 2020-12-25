// Load all packages
const dotenv 		= require('dotenv').config(),
	  express		= require('express'),
	  session		= require('express-session'),
	  crypto 		= require('crypto'),
	  querystring 	= require('querystring'),
	  axios 		= require('axios'),
	  path			= require('path'),
	  mongoose		= require('mongoose');

const app = express();
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

function isLoggedIn(req, res, next) {
	if(req.session.shop) {
		return next();
	}
	res.redirect('/login');
}

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

app.get('/batch', isLoggedIn, (req, res) => {
	res.render('batch/index');
});

app.get('/batch/new', isLoggedIn, (req, res) => {
	res.render('batch/new');
});

app.post('/batch/product/new', isLoggedIn, (req, res) => {
	
});

app.listen(PORT, () => {
	console.log(`Product Uploader App listening on port ${PORT}!`);
});