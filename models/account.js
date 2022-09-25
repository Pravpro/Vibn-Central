const mongoose = require("mongoose");
const { Schema } = mongoose;

// Format Schema setup
const FormatSegmentSchema = new Schema({
	name: String,
	type: { type: String },
	data: Map
});

// SKU Properties Schema setup
const SkuPropertiesSchema = new Schema({
	skuNum: String,
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
		records: [ SkuPropertiesSchema ]
	},
	skuFormat: [ FormatSegmentSchema ],
	skuCounter: { type: Map, of: Number },
	skuRecords: [ SkuPropertiesSchema ]
});

// Model
module.exports = mongoose.model("Account", AccountSchema);