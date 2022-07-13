const origModalHTML = $('#addSkuModal').html();
let activePageIndex = 0;
let lastSelectedRowIndex = null;
let skuSegSelectedValues = {};

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

// Handle Tag Combo delete
$('body').on('click', '.delete-tag-combo', (ev) => $(ev.currentTarget).closest('.tagCombo').remove());

// Handle Navigation buttons for Skugen Create form
$('body').on('click', '.skugen-nav', ev => navigateSkugenForm($(ev.currentTarget).attr('name')) );

// Handle SKU segment option selection
$('body').on('click', '.sku-seg-option', ev => setActiveOption($(ev.currentTarget)) );

// Handle Print button
$('body').on('click', '.print-btn', () => window.print() );

// Handle generate sku labels button
$('body').on('click', '.generate-labels', () => generateSkuLabelsFromTable() );

// Handle Row Select
$('body').on('click', 'tbody>tr', ev => selectRow(ev) );

// Handle Row Select
$('body').on('click', 'th>input', ev => selectAll(ev) );


// Check validity for enabling navigation buttons
let doNavBtnValidations = () => {
    const enableNext = activePageIndex == $('.skugen-form-page').length-1 ? true : activePageIndex < $('.skugen-form-page').length && $($('.skugen-form-page')[activePageIndex]).find('.sku-seg-option').hasClass('btn-warning');
    const enablePrev = activePageIndex > 0;

    $('button[name="next"]').prop('disabled', !enableNext);
    $('button[name="prev"]').prop('disabled', !enablePrev);
}

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
        let response = await axios.get(`/skugen/skuformat/seg/${id}`);
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

// Populate sku labels screen with skus array passed in
let generateSkuLabels = skus => {
    $('.skugen-content').addClass('d-none');
    $('#sku-labels-screen').removeClass('d-none');
    skus.forEach( sku => {
        $('#skus-section').append(`<div class="sku-wrapper"><p class="sku">${sku}</p></div>`);
    });
}

let generateSkuLabelsFromTable = () => {
    skus = [];
    $('tbody>tr.table-active').find('[data-name="skuNum"]').each( function(){
        skus.push( $(this).text() );
    });
    generateSkuLabels(skus);
}

// Make call out to backend to generate skus with properties filled out in the SKU gen form
let generateSkus = async() => {
    $('.spinner-wrapper').removeClass('d-none');

    let data = {};

    let propsFormEntries = new FormData($('#sku-properties-form')[0]).entries();
    let nextProp = propsFormEntries.next();
    data.properties = {};
    while (!nextProp.done){
        data.properties[nextProp.value[0]] = nextProp.value[1];
        nextProp = propsFormEntries.next();
    }

    data.copies = $('input[name=copies]')[0].value;
    data.segments = skuSegSelectedValues;

    console.log(data);
    try{
        let response = await axios.post('/skugen/sku', data, { headers: {"Accept": "application/json"} });
        if(response.status == '200'){
            // Prepare Generated Skus Summary Page
            if(response.data){
                generateSkuLabels(response.data);
            }
        } else {
            if(response.data.error) showToast(`Error ${response.status}`, `${response.data.error}`);
            showToast("Server Error", `The server returned with status code: ${response.status}`);
        }

    } catch (e) {
        showToast("Error", e);
    }

    $('.spinner-wrapper').addClass('d-none');
}

// Navigate skugen create form based on name of button passed in
let navigateSkugenForm = (name) => {
    if(name === 'next'){
        activePageIndex < $('.skugen-form-page').length-1 ? activePageIndex++ : generateSkus();
    } else if(name === 'prev'){
        activePageIndex = activePageIndex > 0 ? activePageIndex-1 : 0;
    }

    // Set Next button label according to page
    $('button[name="next"]').text(activePageIndex == $('.skugen-form-page').length-1 ? 'Generate' : 'Next');

    // Set appropriate page as active
    $('.skugen-form-page').addClass('d-none');
    for( let i = 0; i < $('.skugen-form-page').length; i++ ) if(activePageIndex == i) $('.skugen-form-page')[i].classList.remove('d-none');

    doNavBtnValidations();
}

let selectAll = ev => {
    let target = $(ev.currentTarget);
    if(target.prop('checked') == true) {
        $('tbody>tr').addClass('table-active');
        $('tbody>tr input').prop('checked', true);
    } else {
        $('tbody>tr').removeClass('table-active');
        $('tbody>tr input').prop('checked', false);
    }
    $('#row-count').text($('tbody>tr.table-active').length);

    // Conditions to show footer
    $('tbody>tr.table-active').length > 0 ? $('#sku-table-footer').removeClass('d-none') : $('#sku-table-footer').addClass('d-none');
}

let selectRow = ev => {
    let target = $(ev.currentTarget);
    target.toggleClass('table-active');
    target.find('input').prop('checked', target.hasClass('table-active')); 

    if(ev.shiftKey && lastSelectedRowIndex != null){
        for(let i = lastSelectedRowIndex; i < target.index('tbody>tr'); i++){
            $($('tbody>tr')[i]).addClass('table-active');
            $($('tbody>tr')[i]).find('input').prop('checked', target.hasClass('table-active'));
        }
    }
    lastSelectedRowIndex = target.hasClass('table-active') ? target.index('tbody>tr') : null;

    // Checks for select all checkbox
    $('th>input').prop('checked', $('tbody>tr.table-active').length == $('tbody>tr').length);
    $('#row-count').text($('tbody>tr.table-active').length);

    // Conditions to show footer
    $('tbody>tr.table-active').length > 0 ? $('#sku-table-footer').removeClass('d-none') : $('#sku-table-footer').addClass('d-none');

}

let setActiveOption = (target) => {
    const activePageEl = $('.skugen-form-page')[activePageIndex];

    let allOptionsOnPage = $(activePageEl).find('.sku-seg-option');
    allOptionsOnPage.addClass('btn-outline-warning');
    allOptionsOnPage.removeClass('btn-warning');
    target.addClass('btn-warning');
    target.removeClass('btn-outline-warning');

    skuSegSelectedValues[$(activePageEl).find('.sku-seg-name').text()] = target.text().trim();

    doNavBtnValidations();
}

// Show toast with message
let showToast = (title, msg) => {
    var myAlert = $('.toast'); //select id of toast
    myAlert.find('.toast-header>strong').text(title) //set title
    myAlert.find('.toast-body').text(msg); //set message
    var bsAlert = new bootstrap.Toast(myAlert[0]); //inizialize it
    bsAlert.show(); //show it
}