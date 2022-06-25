const mongoose = require("mongoose");
const { Schema } = mongoose;

// Format Schema setup
const FormatSegmentSchema = new Schema({
	name: String,
	type: { type: String },
	data: Map
});

const SkuPropertiesSchema = new Schema({
	costOfGood: Number,
	location: String
});

// Account schema setup
const AccountSchema = new Schema({
	shop: String,
	accessToken: Object,
	sku: {
		format: [ FormatSegmentSchema ],
		counter: { type: Map, of: Number },
		records: { type: Map, of: SkuPropertiesSchema }
	}
});

// Model
module.exports = mongoose.model("Account", AccountSchema);