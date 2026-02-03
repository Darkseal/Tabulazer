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

function renderTables(tables) {
    var $list = $("#tablesList");
    $list.empty();

    if (!tables || !tables.length) {
        $list.append('<div style="font-size:0.85em; opacity:0.8;">No tables found.</div>');
        return;
    }

    tables.forEach(function(t) {
        var label = "#" + (t.index + 1) + " — " + (t.rows || 0) + "x" + (t.cols || 0);
        var $btn = $("<button/>")
            .addClass("btn btn-sm btn-light btn-block text-left")
            .css({ marginTop: "4px" })
            .text(label)
            .on("click", function() {
                chrome.runtime.sendMessage({ type: "activateById", tableId: t.id });
                window.close();
            });
        $list.append($btn);
    });
}

function refreshTables() {
    chrome.runtime.sendMessage({ type: "popupListTables" }, function(resp) {
        if (!resp || !resp.ok) {
            renderTables([]);
            return;
        }
        renderTables(resp.tables);
    });
}

$(function() {
    restore_options();

    $("form.form").on("change", "input", function (e) {
        save_options();
    });

    $("#btnPick").on("click", function() {
        chrome.runtime.sendMessage({ type: "popupStartPicker" }, function() {
            window.close();
        });
    });

    $("#btnToggleLast").on("click", function() {
        chrome.runtime.sendMessage({ type: "popupToggleLast" }, function() {
            window.close();
        });
    });

    $("#btnRefresh").on("click", function() {
        refreshTables();
    });

    refreshTables();
});
