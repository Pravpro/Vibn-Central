const mongoose = require("mongoose");
const { Schema } = mongoose;

// Format Schema setup
const FormatSegmentSchema = new Schema({
	name: String,
	type: { type: String },
	data: Map
});

// Account schema setup
const AccountSchema = new Schema({
	shop: String,
	accessToken: Object,
	sku: {
		format: [FormatSegmentSchema],
		record: { type: Map, of: Number }
	}
});

// Model
module.exports = mongoose.model("Account", AccountSchema);