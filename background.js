async function createExport(tabId) {
  async function sendFetchRequest(options) {
    return new Promise(resolve => {
      chrome.tabs.sendMessage(tabId, options,(response) => {
        resolve(response);
      }); 
    });
  }

  async function fetchData(options) {
    return (await sendFetchRequest(options)).data;
  };

  async function fetchBlob(options) {
    return await sendFetchRequest(options);
  };

  async function fetchBlobUrl(url) {
    return new Promise((resolve, reject) => {
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

  // let projects = await fetchData({json: "https://app.asana.com/api/1.0/projects"});
  // let projectData = await Promise.all(projects.map(x=> fetchData(
  //   {json: `https://app.asana.com/api/1.0/projects/${x.id}/tasks?opt_pretty&opt_expand=(this%7Csubtasks%2B)`})));
  
  // let attachments = [];
  // await Promise.all(projectData.map(async x=> {
  //   await Promise.all(x.map(async task=> {
  //     let attachmentData = await fetchData({json: `https://app.asana.com/api/1.0/tasks/${task.id}/attachments`});
  //     for (let data of attachmentData) {
  //       attachments.push({
  //         taskId: task.id,
  //         data: data,
  //       });
  //     }
  //   }));
  // }));

  // console.log(attachments);

  let attachment = {
    data: {
      gid: "16029329955098",
      id: 16029329955098,
      name: "360.gif",
      resource_type: "attachment"
    },
    taskId: 15725217530580
  };


  let blobUrl = await fetchBlob({blob: `https://app.asana.com/app/asana/-/get_asset?asset_id=${attachment.data.id}`});
  console.log(attachment, blobUrl);
  let attachmentBlob = await fetchBlobUrl(blobUrl);

  // let resp = await fetch(blobUrl);
  // let blob = await resp.blob();
  // console.log(blob);

  // get attachment data as blobs and put in the zip
  // verify the downloaded zip has attachments properly when extracted

  var zip = new JSZip();
  // zip.file("projects.json", JSON.stringify(projects));
  // zip.file("tasks.json", JSON.stringify(projectData));
  // zip.file("attachments.json", JSON.stringify(attachments));
  zip.file(attachment.data.name, attachmentBlob);
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

async function fetchBlob(url) {
  let resp = await fetch(url);
  return await resp.blob();
};

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.json) {
    fetchJson(msg.json).then(x=> {
      sendResponse(x);
    });
  } else {
    fetchBlob(msg.blob).then(x=> {
      let url = URL.createObjectURL(x);
      console.log('url', url);
      sendResponse(url);
    });
  }
  return true;
});
`},
    (result) => createExport(asanaTab.id));
  })
});

