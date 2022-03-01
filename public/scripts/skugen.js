const origModalHTML = $('#addSkuModal').html();

$(function(){
    // Inizialize Alert if message/title is provided
    const myAlert = $('.toast');
    if(myAlert.find('.toast-header>strong').text().trim() || myAlert.find('.toast-body').text().trim()){
        var bsAlert = new bootstrap.Toast(myAlert[0]);
        bsAlert.show();
    }
});

// Handle view change of sku part form based on Sku Part Type picklist
$('body').on('change', '#skuPartType', ev => {
    if(ev.target.value === "tags") {
        $("#seqNumSection").addClass('d-none');
        $("#tagCombosSection").removeClass('d-none');
    } else if(ev.target.value === "seqNum") {
        $("#seqNumSection").removeClass('d-none');
        $("#tagCombosSection").addClass('d-none');
    }
});

// Handle Add Tag button click for Sku Part
$('body').on('click', '#addTagCombo', () => $('#tagCombos').append($('.tagCombo')[0].outerHTML));

// Handle form hidden field update on add sku part button click
$('body').on('click', '.add-part-btn', ev => { $('input[name="skuIndex"]').val(ev.currentTarget.id.substring(9)); });

// Handle form submission of sku part form on click of Save button
$('body').on('click', '#submit-sku-part-form', () => { $('#sku-part-form').submit(); $('.spinner-wrapper').removeClass('d-none');});

// Handle Pre-population of sku segment form on click of sku part
$('body').on('click', '.sku-part', (ev) => prePopulateSkuForm($(ev.currentTarget).find("input").val()));

// Handle hide modal Bootstrap event
$('body').on('hide.bs.modal', '.modal', () => $('#addSkuModal').html(origModalHTML));


// Pre Populate the sku segment form by using the unique mongoose object id  
let prePopulateSkuForm = async(id) => {
    $('.spinner-wrapper').removeClass('d-none');
    let segment = await getSegmentData(id);

    // Set Name of sku segment
    $('#skuPartName').val(segment.name);
    
    // Set Type
    $('#skuPartType').val(segment.type).change();

    // Set data according to type
    if(segment.type == 'tags'){
        const tagAbbPairs = Object.entries(segment.data);
        for(let i = 0; i < tagAbbPairs.length; i++){
            $('.tagCombo').find('input[name=key]')[i].value = tagAbbPairs[i][0];
            $('.tagCombo').find('input[name=value]')[i].value = tagAbbPairs[i][1];
            if(i !== tagAbbPairs.length - 1){
                $('#tagCombos').append($('.tagCombo')[0].outerHTML);
            }
        }
    }
    else if(segment.type == 'seqNum') $('#seqNum').val(segment.data['']);

    // Set up form for update and delete
    $('#sku-part-form').attr('action', $('#sku-part-form').attr('action') + `/${segment._id}?_method=PUT`);
    $('#sku-part-del-form').attr('action', $('#sku-part-del-form').attr('action') + `/${segment._id}?_method=DELETE`);
    $('#del-seg-btn').removeClass('d-none');
    $('.spinner-wrapper').addClass('d-none');
}

// Responsible for correctly fetching the sku segment data using the segment id
let getSegmentData = async(id) => {
    try{
        let response = await axios.get(`/skugen/sku/seg/${id}`);
        if(response.status == 200){
            if(response.data) return response.data;
            else showToast("Data Fetch Error", "Couldn't find any data for this sku segment.");
        } else {
            showToast("Server Error", `The server returned with status code: ${response.status}`);
        }
    } catch(e) {
        showToast("Error", e);
    }
    return null;
}

// Show toast with message
let showToast = (title, msg) => {
    var myAlert = $('.toast'); //select id of toast
    myAlert.find('.toast-header>strong').text(title) //set title
    myAlert.find('.toast-body').text(msg); //set message
    var bsAlert = new bootstrap.Toast(myAlert[0]); //inizialize it
    bsAlert.show(); //show it
}