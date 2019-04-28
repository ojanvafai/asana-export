async function createExport(tabId) {
  async function fetchData(options) {
    return new Promise(resolve => {
      chrome.tabs.sendMessage(tabId, options,(response) => {
        resolve(response.data);
      }); 
    })
  };

  let projects = await fetchData({json: "https://app.asana.com/api/1.0/projects"});
  let projectData = await Promise.all(projects.map(x=> fetchData(
    {json: `https://app.asana.com/api/1.0/projects/${x.id}/tasks?opt_pretty&opt_expand=(this%7Csubtasks%2B)`})));
  
  let attachments = [];
  await Promise.all(projectData.map(async x=> {
    await Promise.all(x.map(async task=> {
      let attachmentData = await fetchData({json: `https://app.asana.com/api/1.0/tasks/${task.id}/attachments`});
      for (let data of attachmentData) {
        attachments.push({
          taskId: task.id,
          data: data,
        });
      }
    }));
  }));

  console.log(attachments);

  // get attachment data as blobs and put in the zip
  // verify the downloaded zip has attachments properly when extracted

  var zip = new JSZip();
  zip.file("projects.json", JSON.stringify(projects));
  zip.file("tasks.json", JSON.stringify(projectData));
  zip.file("attachments.json", JSON.stringify(attachments));
  let blob = await zip.generateAsync({type:"blob"});

  var url = URL.createObjectURL(blob);
  chrome.downloads.download({
    url: url,
    // TODO: Put the date in the name of the zip.
    filename: "asana.zip" // Optional
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

async function fetchText(url) {
  let resp = await fetch(url);
  return await resp.text();
};

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.json) {
    fetchJson(msg.json).then(x=> {
      sendResponse(x);
    });
  } else {
    fetchText(msg.text).then(x=> {
      sendResponse(x);
    });
  }
  return true;
});
`},
    (result) => createExport(asanaTab.id));
  })
});

