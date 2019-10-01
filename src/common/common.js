function initTable(el) {
    var table = null;
    var $t = $(el).closest("div.tabulator");
    if ($t && $t.length > 0) {
        /* todo - disable tabulator */
    }
    else {
        var $t = $(el).closest("table");
        if ($t && $t.length > 0) {

            // if the table has not TH on first line, change all TDs to THs
            $t.find('tr:first td').wrapInner('<div />').find('div').unwrap().wrap('<th />');

            // if there are empty TH on first line, fill them so they will be sortable/searchable as well
            var thCnt = 0;
            $t.find('tr:first th').each(function (i, e) {
                var $e = $(e);
                if (!$e.text().trim()) {
                    thCnt++;
                    $(e).html("#"+thCnt);
                }
            }); 

            chrome.storage.sync.get({
                forceWidth: false,
                sorting: true,
                filters: true,
                paging: true
            },
                function (items) {
                    if (items.forceWidth) {
                        // set the table to 100% width
                        $t.css({ width: "100% !important" });
                        $t.parents().attr("width", "100%").css({ width: "100% !important" });
                    }

                    var options = {
                        layout: "fitColumns",
                        movableColumns: false,
                        resizableColumns: true,
                        headerFilterPlaceholder: "",
                        clipboard: true, //enable clipboard functionality
                        clipboardCopySelector: "table", //change default selector to active
                        clipboardCopyStyled: false,
                        clipboardCopyFormatter: function (data) {
                            var output = [];

                            // temporary patch until Tabulator fixes this bug
                            // https://github.com/olifolkerd/tabulator/pull/2399
                            data.forEach(function (row) {
                                var newRow = [];
                                row.forEach(function (value) {
                                    if (typeof value == "undefined") {
                                        value = "";
                                    }

                                    value = typeof value == "undefined" || value === null ? "" : value.toString();

                                    if (value.match(/\r|\n/)) {
                                        value = value.split('"').join('""');
                                        value = '"' + value + '"';
                                    }
                                    newRow.push(value);
                                });
                                output.push(newRow.join("\t"));
                            });

                            return output.join("\n");

                        },
                        clipboardCopied: function (clipboard) {
                            // clipboard - the string that has been copied into the clipboard
                        },
                    };

                    if (items.paging) {
                        // enable paging
                        options.pagination = "local";
                        options.paginationSize = 100;
                    }

                    table = new Tabulator($t.get(0), options);
                    
                    var columns = table.getColumnDefinitions();
                    columns.forEach(column => {
                        column.width = null;
                        column.tooltip = true;
                        column.formatter = "html";
                        if (items.filters) {
                            column.headerFilter = "input";
                        }
                    });
                    table.setColumns(columns);

                    // force a redraw to fix row vertical spacing issues
                    table.redraw();
                });

        }
    }
}
