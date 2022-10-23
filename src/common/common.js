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

            chrome.storage.sync.get(
                {
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
                        columnDefaults:{
                            resizable: "header",
                            formatter: "html",
                            width: null,
                            tooltip: true,
                            headerFilterPlaceholder: "",
                            headerFilter: "input",
                        },            
                        clipboard: true, //enable clipboard functionality
                        clipboardCopyRowRange: "all", //change default selector to active
                        clipboardCopyStyled: false,
                    };

                    if (items.paging) {
                        // enable paging
                        options.pagination = true,
                        options.paginationMode = "local",
                        options.paginationSize = 100;
                    }

                    table = new Tabulator($t.get(0), options);
                });

        }
    }
}
