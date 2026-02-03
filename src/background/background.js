var tabulazer = {
    menuItemId: "tabulazer-activate"
};

chrome.contextMenus.create({
    id: tabulazer.menuItemId,
    type: "normal",
    title: "Tabulazer - Table Filter and Sorter",
    contexts: [ "page" ],
    },
    function () {
        // do nothing.
    }
);

chrome.contextMenus.onClicked.addListener(function (info, tab) {
    if (info.menuItemId == tabulazer.menuItemId) {
        chrome.tabs.sendMessage(tab.id, "getClickedElement", function (e) {
            renderTable(e, tab);
        });
    }
});

chrome.browserAction.onClicked.addListener(function (tab) {
});

function executeScripts(tabId, injectDetailsArray) {
    function createCallback(tabId, injectDetails, innerCallback) {
        return function () {
            chrome.tabs.executeScript(tabId, injectDetails, innerCallback);
        };
    }

    var callback = null;

    for (var i = injectDetailsArray.length - 1; i >= 0; --i)
        callback = createCallback(tabId, injectDetailsArray[i], callback);

    if (callback !== null)
        callback();
}

function renderTable(e, tab) {
    chrome.tabs.sendMessage(tab.id, "getInjected", function (e2) {
        var scripts = [];

        if (e2.value) {
            console.log("aleady injected: do nothing");
        }
        else {
            console.log("injecting libs...")
            scripts = [
                { file: "lib/jquery/3.4.1/jquery.min.js" },
                { file: "lib/tabulator/4.4/js/tabulator.min.js" },
                { file: "src/common/common.js" },
            ];
            chrome.tabs.insertCSS({ file: 'lib/tabulator/4.4/css/tabulator_simple.min.css', runAt: 'document_start' });
            chrome.tabs.insertCSS({ file: 'src/content/css/content.css', runAt: 'document_start' });

            chrome.tabs.sendMessage(tab.id, "setInjected");
            console.log("... done.")
        }

        scripts.push({ code: "initTable(tabulazer.clickedElement);" });
        executeScripts(null, scripts);
    });
}
