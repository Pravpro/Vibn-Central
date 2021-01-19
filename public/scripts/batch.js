const productHtml = $('.product')[0].outerHTML;

$('#new').click(() => {
	$('#products-section').append(productHtml);
});

$('#submit').click(async (e) => {
	let products = $('.product');

	await Promise.allSettled(products.map(async (i, product) => {
		let data = {
			title : $(product).find("input[name='title']").val()
		}
		console.log(data);
		axios.post('/batch/product/new', data)
		.then( res => { console.log(res.data); })
		.catch( err => { console.log(err); });
	}));
})