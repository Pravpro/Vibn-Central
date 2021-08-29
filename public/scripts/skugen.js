$('body').on('change', '#skuPartType', ev => {
    console.log(ev.target.value);
    if(ev.target.value === "tags") {
        $("#seqNumSection").addClass('d-none');
        $("#tagCombosSection").removeClass('d-none');
    } else if(ev.target.value === "seqNum") {
        $("#seqNumSection").removeClass('d-none');
        $("#tagCombosSection").addClass('d-none');
    }
});

$('body').on('click', '#addTagCombo', ev => {
    $('#tagCombos').append($('.tagCombo')[0].outerHTML);
})