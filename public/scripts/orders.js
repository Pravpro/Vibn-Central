let startDate, endDate;
let timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

let showToast = (index) => {
    // Initialize toast
    var myAlert = $('.toast');//select id of toast
    var bsAlert = new bootstrap.Toast(myAlert[index]);//inizialize it
    bsAlert.show();//show it
}
let getOrders = async() => {
    $('.spinner-wrapper').removeClass('d-none');
    var collectionValue = $('#collection') ? $("#collection").val() : null;

    // If there is a collection value defined do validation before call out
    if(collectionValue){
        var collectionOpt = $("#collections").find("option[value='" + collectionValue + "']");
    
        if(collectionOpt != null && collectionOpt.length > 0){
            // Post to endpoint that will handle Shopify API call
            let res = await axios.post('/orders', {'start': startDate, 'end': endDate, 'timeZone': timeZone, 'collectionId': collectionOpt.data('id')}, { headers: {"Accept": "application/json"} });
            if(res.status == 200) showToast(2);
        }
        else
            showToast(1) // don't allow form submission
    } else {
        // Post to endpoint that will handle Shopify API call
        let res = await axios.post('/orders', {'start': startDate, 'end': endDate, 'timeZone': timeZone}, { headers: {"Accept": "application/json"} });
        if(res.status == 200) showToast(2);

    }

    $('.spinner-wrapper').addClass('d-none');
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

/************************* HANDLERS ***********************************/

// handler for export button click
$('#export-btn').click(() => {
    // Check if date range has been set
    !startDate ? showToast(0) : getOrders();
});