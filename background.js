async function fetchBlobUrl(url) {
  return new Promise((resolve, reject) => {
    // Need to use XHR to avoid CORS issues apparently. :(
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'blob';
    xhr.onload = function(e) {
      if (this.status == 200)
        resolve(this.response);
      else
        reject(this);
    };
    xhr.send();
  });
};

function stringify(obj) {
  return JSON.stringify(obj, (key, value) => {
    // Prevent IDs from being converted to scientific notation.
    if (typeof value === 'number')
      return String(value);
    return value;
  });
}

async function createExport(tabId) {
  async function sendFetchRequest(options) {
    return new Promise(resolve => {
      chrome.tabs.sendMessage(tabId, options, (response) => {
        resolve(response);
      }); 
    });
  }

  async function fetchData(options) {
    return (await sendFetchRequest(options)).data;
  };

  var zip = new JSZip();
  let projectMetadata = await fetchData({json: "https://app.asana.com/api/1.0/projects"});
  let projectData = await Promise.all(projectMetadata.map(x => fetchData(
    {json: `https://app.asana.com/api/1.0/projects/${x.id}/tasks?opt_pretty&opt_expand=(this%7Csubtasks%2B)`})));

  let attachments = [];
  await Promise.all(projectData.map(async x=> {
    // TODO: Should probably rate limit this.
    await Promise.all(x.map(async task=> {
      let data = await fetchData({json: `https://app.asana.com/api/1.0/tasks/${task.id}/attachments`});
      for (let attachment of data) {
        let attachmentMetadata = await fetchData({json: `https://app.asana.com/api/1.0/attachments/${attachment.id}`});
        // Dropbox download URLs incorrectly have both dl=0 and dl=1 and the dl=0 wins.
        // Force dl=1 so it gets the dropbox download instead of the viewer.
        let blobUrl = await sendFetchRequest({blob: attachmentMetadata.download_url.replace('dl=0', 'dl=1')});

        zip.folder('attachments').folder(task.id).file(attachment.name, await fetchBlobUrl(blobUrl));
        attachments.push({
          taskId: task.id,
          data: attachmentMetadata,
        });
      }
    }));
  }));

  zip.file("projects.json", stringify(projectMetadata));
  zip.file("tasks.json", stringify(projectData));
  zip.file("attachments.json", stringify(attachments));

  let date = new Date();
  let blob = await zip.generateAsync({type:"blob"});
  chrome.downloads.download({
    url: URL.createObjectURL(blob),
    filename: `asana-${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}.zip`
  });
};

chrome.browserAction.onClicked.addListener(async (extensionTab) => {
  chrome.tabs.create({url: 'https://app.asana.com'}, (asanaTab) => {
    chrome.tabs.executeScript(asanaTab.id,
      // Need to have asana.com credentials, so do fetches via content script.
      {code: `
async function fetchJson(url) {
  let resp = await fetch(url);
  return await resp.json();
};

async function fetchBlob(url) {
  let resp = await fetch(url);
  return await resp.blob();
};

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.json) {
    fetchJson(msg.json).then(x=> sendResponse(x));
  } else {
    fetchBlob(msg.blob).then(x => sendResponse(URL.createObjectURL(x)));
  }
  return true;
});
`},
    (result) => createExport(asanaTab.id));
  })
});

