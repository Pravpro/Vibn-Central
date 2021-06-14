let startDate, endDate;

let showToast = () => {
    // Initialize toast
    var myAlert = $('.toast');//select id of toast
    var bsAlert = new bootstrap.Toast(myAlert[0]);//inizialize it
    bsAlert.show();//show it
}
let getOrders = async() => {
    // Post to endpoint that will handle Shopify API call
    let res = await axios.post('/orders', {'start': startDate, 'end': endDate}, { headers: {"Accept": "application/json"} });
    res.data.redirect ? window.location.href = res.data.redirect : console.log(res.data);
}

// Run functions on document ready
$(function() {
    $('input[name="daterange"]').daterangepicker({
        opens: 'left'
    }, function(start, end, label) {
        startDate = start;
        endDate = end;
        console.log("A new date selection was made: " + start.format('YYYY-MM-DD') + ' to ' + end.format('YYYY-MM-DD'));
    });
});

// handler for export button click
$('#export-btn').click(() => {
    // Check if date range has been set
    !startDate ? showToast() : getOrders();
})