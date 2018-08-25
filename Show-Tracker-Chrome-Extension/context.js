function SignIn(data, sender, sendResponse)
{
    fetch("http://shows.colinrumball.com/sign-in",{
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        credentials: 'include',
        body: JSON.stringify({
            username: data.username, 
            password: data.password
        })
    })
    .then(response => sendResponse(!response.url.includes("sign-in")))
    .catch(err => sendResponse(false))
    return true;
}

function AddMagnetLink(data) 
{
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {data: "test"}, function(response) {
            console.log('success');
        });
    });
    // let magnetLink = data.linkUrl;
    // fetch("http://shows.colinrumball.com/movie-torrents",{
    //     method: 'POST',
    //     headers: {
    //         "Content-Type": "application/json"
    //     },
    //     credentials: 'include',
    //     body: JSON.stringify({
    //         link: magnetLink,
    //     })
    // })
    // .then((response) =>
    // {
    //     chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    //         chrome.tabs.sendMessage(tabs[0].id, {data: "test"}, function(response) {
    //             console.log('success');
    //         });
    //     });
    // })
    // .catch(err => console.log(err));
}

chrome.contextMenus.create({
    "title": "Add Magnet Link Remotely",
    "contexts":["link"],
    "onclick": AddMagnetLink
});

chrome.runtime.onMessage.addListener(SignIn);