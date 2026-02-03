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

var _refreshTimer = null;

function setStatus(msg) {
    $("#statusMsg").text(msg || "");
}

function refreshTablesDebounced() {
    if (_refreshTimer) {
        clearTimeout(_refreshTimer);
    }
    _refreshTimer = setTimeout(function() {
        refreshTables();
    }, 350);
}

function renderTables(tables) {
    var $list = $("#tablesList");
    $list.empty();

    if (!tables || !tables.length) {
        $list.append('<div style="font-size:0.85em; opacity:0.8;">No tables found.</div>');
        return;
    }

    tables.forEach(function(t) {
        var state = !!t.active;
        var label = "#" + (t.index + 1) + " — " + (t.rows || 0) + "x" + (t.cols || 0);

        var $row = $("<div/>").css({
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "8px",
            marginTop: "6px",
            padding: "6px 8px",
            background: state ? "#e8f5e9" : "#fff",
            border: "1px solid rgba(0,0,0,.08)",
            borderRadius: "6px",
        });

        var $left = $("<div/>").css({ flex: "1 1 auto", fontSize: "0.9em" }).text(label);

        var $toggle = $("<input/>")
            .attr("type", "checkbox")
            .prop("checked", state)
            .on("change", function() {
                var el = this;
                var next = $(el).is(":checked");

                // Avoid double-clicks / flicker: disable until refresh.
                $(el).prop("disabled", true);
                setStatus("Working...");

                var msg = next ? { type: "activateById", tableId: t.id } : { type: "deactivateById", tableId: t.id };
                chrome.runtime.sendMessage(msg, function(resp) {
                    // Best-effort: show error if the SW reported one
                    if (resp && resp.ok === false && resp.error) {
                        setStatus(resp.error);
                    } else {
                        setStatus("");
                    }

                    // Refresh twice: immediate + debounced (activation can take a moment).
                    refreshTables();
                    refreshTablesDebounced();
                });
            });

        var $right = $("<div/>").css({ flex: "0 0 auto" }).append($toggle);

        $row.append($left, $right);
        $list.append($row);
    });
}

function refreshTables() {
    chrome.runtime.sendMessage({ type: "popupListTables" }, function(resp) {
        if (!resp || !resp.ok) {
            if (resp && resp.error) setStatus(resp.error);
            renderTables([]);
            return;
        }
        setStatus("");
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
        setStatus("Working...");
        chrome.runtime.sendMessage({ type: "popupToggleLast" }, function() {
            refreshTables();
            refreshTablesDebounced();
        });
    });

    $("#btnRefresh").on("click", function() {
        refreshTables();
    });

    refreshTables();
});
