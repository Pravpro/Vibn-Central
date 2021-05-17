const productHtml = $('.product')[0].outerHTML;

$('#new').click(() => {
	$('#products-section').append(productHtml);
	initTinymce();
});

// Handle Sumbit button click event
$('#submit').click(async (e) => {
	const products = $('.product');
	
	// TODO: Create Spinner for Submission
	// Disable Submit button
	$('#submit')[0].disabled = true;

	// Submit all products with their input information
	await Promise.allSettled(products.map(async (i, product) => {
		console.log("HELLOO")

		// Create image urls
		// const images = $('input[name="images"]')[i].files;
		// console.log(images);
		// let imageURLs = [];
		// for (let j = 0; j < images.length; j++) {
		// 	imageURLs.push(URL.createObjectURL(images[j]));
		// }
		// console.log(imageURLs);

		// Capture data to send for product
		const formData = new FormData();
		formData.append('title', $(product).find("input[name='title']").val());
		formData.append('description', tinymce.get(i).getContent().replace(/"/g, '\\"'));
		formData.append('quantity',{
			[ $('#quantity input')[0].name ] : $('#quantity input').val()
		});
		console.log("Append images to formData");
		$.each($('input[name="images"]')[i].files, (i, file) => formData.append('images', file) );

		console.log(formData);

		// Post to endpoint that will handle Shopify API call
		let res = await axios.post('/batch/product/new', formData, {
			headers: {
				'Content-Type': 'multipart/form-data'
			}
		});
		// for (let j = 0; j < images.length; j++) {
		// 	URL.revokeObjectURL(imageURLs[j]);
		// }
		console.log(res.data);
	}));
	$('#submit')[0].disabled = false;
});