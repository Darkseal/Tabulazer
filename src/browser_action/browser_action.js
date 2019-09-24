// Saves options to chrome.storage
function save_options() {
    var forceWidth = $('#forceWidth').is(":checked");
    var sorting = $('#sorting').is(":checked");
    var filters = $('#filters').is(":checked");
    var paging = $('#paging').is(":checked");
    chrome.storage.sync.set({
        forceWidth: forceWidth,
        sorting: sorting,
        filters: filters,
        paging: paging
    });
}

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
function restore_options() {
    // Use default value color = 'red' and likesColor = true.
    chrome.storage.sync.get({
        forceWidth: false,
        sorting: true,
        filters: true,
        paging: true
    }, function (items) {
        $('#forceWidth').prop("checked", items.forceWidth);
        $('#sorting').prop("checked", items.sorting);
        $('#filters').prop("checked", items.filters);
        $('#paging').prop("checked", items.paging);
    });
}

$(function() {
    restore_options();

    $("form.form").on("change", "input", function (e) {
        save_options();
    });
});
