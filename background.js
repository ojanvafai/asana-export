async function createExport(tabId) {
  async function fetchData(options) {
    return new Promise(resolve => {
      chrome.tabs.sendMessage(tabId, options,(response) => {
        resolve(response.data);
      }); 
    })
  };


  let projects = await fetchData({json: "https://app.asana.com/api/1.0/projects"});

  console.log(projects);
  let projectData = await Promise.all(projects.map(x=> fetchData(
    {json: `https://app.asana.com/api/1.0/projects/${x.id}/tasks?opt_pretty&opt_expand=(this%7Csubtasks%2B)`})));
  
    console.log(projectData);
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
  // get attachment dats a files
  // dump projects, projectData, attachments as one big zip
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

