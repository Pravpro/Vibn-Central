$(function(){
    let zones = Intl.supportedValuesOf('timeZone');
    let zonesHTML = '';
    zones.forEach(zone => {
        zonesHTML += `<option value="${zone}">`;
    });
    $('#time-zone-list').html(zonesHTML);
});

let showToast = (index) => {
    // Initialize toast
    var myAlert = $('.toast');//select id of toast
    var bsAlert = new bootstrap.Toast(myAlert[index]);//inizialize it
    bsAlert.show();//show it
}

// Handle detect timezone button click
$('body').on('click', '#detect-timezone-btn', () => $('input[name="timeZone"]').val(Intl.DateTimeFormat().resolvedOptions().timeZone));

$('body').on('submit', e => {
    // Prevent the default form submit
    e.preventDefault();
    $('button').prop('disabled', true);
    $('.spinner-wrapper').removeClass('d-none');

    // Store reference to form to make later code easier to read
    const form = e.target;

    // Post data using the Fetch API
    let res = axios({
        method: form.method,
        url: form.action,
        data: new FormData(form),
    }).then(res => {
        if(res.status) showToast(0);
        $('button').prop('disabled', false);
        $('.spinner-wrapper').addClass('d-none');
    });

})