const productHtml = $('.product')[0].outerHTML;

$('#new').click(() => {
	$('#products-section').append(productHtml);
	initTinymce();
});

$('#submit').click(async (e) => {
	let products = $('.product');
	$('#submit')[0].disabled = true;
	await Promise.allSettled(products.map(async (i, product) => {
		let data = {
			title : $(product).find("input[name='title']").val(),
			description: tinymce.get(i).getContent().replace(/"/g, '\\"'),
			quantity: {
				[ $('#quantity input')[0].name ] : $('#quantity input').val()
			}
		}
		console.log(data);
		let res = await axios.post('/batch/product/new', data);
		console.log(res.data);
	}));
	$('#submit')[0].disabled = false;
});