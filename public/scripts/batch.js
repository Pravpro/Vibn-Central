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
	
	// Submit all products (1 at a time) with their input information
	for(let i = 0; i < products.length; i++){
		
		// Capture data to send for product
		const formData = new FormData();
		formData.append('title', $(products[i]).find("input[name='title']").val());
		formData.append('description', tinymce.get(i).getContent().replace(/"/g, '\\"'));
		formData.append('quantity',{
			[ $('#quantity input')[0].name ] : $('#quantity input').val()
		});
		console.log("Append images to formData");
		$.each($(products[i]).find('input[name="images"]')[0].files, (i, file) => formData.append('images', file) );
		
		console.log(formData);
		
		// Post to endpoint that will handle Shopify API call
		let res = await axios.post('/batch/product/new', formData, {
			headers: {
				'Content-Type': 'multipart/form-data'
			}
		});
		console.log(res.data);
	}
	$('#submit')[0].disabled = false;
});
	
	// !!!CODE MAY COME IN USEFUL FOR DISPLAYING IMAGES ON BROWSER!!
	// //Create image urls
	// const images = $('input[name="images"]')[i].files;
	// console.log(images);
	// let imageURLs = [];
	// for (let j = 0; j < images.length; j++) {
	// 	imageURLs.push(URL.createObjectURL(images[j]));
	// }
	// console.log(imageURLs);