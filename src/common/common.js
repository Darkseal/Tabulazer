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
                        headerFilterPlaceholder: ""
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
                });

        }
    }
}
