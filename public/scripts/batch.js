const productHtml = $('.product')[0].outerHTML;

$('#new').click(() => {
	$('#products-section').append(productHtml);
});