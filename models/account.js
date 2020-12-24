const mongoose = require("mongoose");

// Schema setup
let accountSchema = new mongoose.Schema({
	shop: String,
	accessToken: Object
});

// Model
module.exports = mongoose.model("Account", accountSchema);