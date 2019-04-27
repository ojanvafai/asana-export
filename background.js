async function fetchData(tabId, options) {
  chrome.tabs.sendMessage(tabId, options,(response) => {
    console.log(response);
  }); 
}

async function createExport(tabId) {
  let projects = await fetchData(tabId, {json: "https://app.asana.com/api/1.0/projects"});
  console.log(projects);
};

chrome.browserAction.onClicked.addListener(async (extensionTab) => {
  chrome.tabs.create({url: 'https://app.asana.com'}, (asanaTab) => {
    chrome.tabs.executeScript(asanaTab.id,
      // Need to have asana.com credentials, so do via content script.
      {code: `
async function fetchJson(url) {
  let resp = await fetch(url);
  return await resp.json();
};

async function fetchText(url) {
  let resp = await fetch(url);
  return await resp.text();
};

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.json) {
    fetchJson(msg.json).then(x=> {
      console.log(x);
      sendResponse(x);
    });
  } else {
    fetchText(msg.text).then(x=> {
      console.log(x);
      sendResponse(x);
    });
  }
  return true;
});

'done';
`},
    (result) => createExport(asanaTab.id));
  })
});

