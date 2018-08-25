chrome.runtime.onMessage.addListener( function(request, sender, sendResponse) {
    var body = document.querySelector("body");
    body.innerHTML += "<div class=\"ShowTracker_overlay\"><div class=\"ShowTracker_widget\"><span>Torrent Added Successfully</span></div></div>";

    var overlay = document.querySelector(".ShowTracker_overlay");
    
    setTimeout(() => {
        overlay.style.opacity = '0';
    }, 1000);

    setTimeout(() => {
        overlay.parentNode.removeChild(overlay);
    }, 2550);

    sendResponse();
});