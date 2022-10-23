const tabulazer = {
    menuItemId: "tabulazer-activate"
};


function callInitTable(tab) {
    chrome.scripting.executeScript({
        func: () => {
            initTable(tabulazer.clickedElement)
        },
        target: {
            tabId: tab.id,
        }
    })
}

async function renderTable(e, tab) {
    await injectScripts(e, tab)
    callInitTable(tab);
}

function injectScripts(e, tab, callback) {
    return new Promise(resolve => {
        chrome.tabs.sendMessage(tab.id, "getInjected", e2 => {
            if (e2.value) {
                console.log("aleady injected: do nothing");
                resolve()
            }
            else {
                console.log("injecting libs...")
                return Promise.all([
                    chrome.scripting.executeScript({
                        files: [
                            "lib/jquery/3.4.1/jquery.min.js",
                            "lib/tabulator/5.4.2/js/tabulator.min.js",
                            "src/common/common.js",
                        ],
                        target: {
                            tabId: tab.id,
                        }
                    }),
                    chrome.scripting.insertCSS({
                        files: [
                            'lib/tabulator/5.4.2/css/tabulator_simple.min.css',
                            'src/common/common.css'
                        ],
                        target: {
                            tabId: tab.id,
                        }
                    })
                ]).then(() => {
                    chrome.tabs.sendMessage(tab.id, "setInjected");
                    console.log("... done.")
                    resolve()
                });
            }
        });
    });
}

chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: tabulazer.menuItemId,
        type: "normal",
        title: "Tabulazer - Table Filter and Sorter",
        contexts: [ "page" ],
    })

    chrome.contextMenus.onClicked.addListener((info, tab) => {
        if (info.menuItemId == tabulazer.menuItemId) {
            chrome.tabs.sendMessage(tab.id, "getClickedElement", e => renderTable(e, tab));
        }
    });
});
