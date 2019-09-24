var tabulazer = {
    clickedElement: null,
    isInjected: false
};

document.addEventListener("contextmenu", function (event) {
    tabulazer.clickedElement = event.target;
}, true);

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    switch (request) {
        case "getClickedElement":
            sendResponse({ value: tabulazer.clickedElement.value });
            break;
        case "getInjected":
            sendResponse({ value: tabulazer.isInjected });
            break;
        case "setInjected":
            tabulazer.isInjected = true;
            break;
    }
});
