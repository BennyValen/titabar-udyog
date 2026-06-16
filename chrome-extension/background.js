chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' &&
      tab.url && tab.url.includes('web.whatsapp.com')) {
    setTimeout(() => {
      chrome.tabs.sendMessage(tabId, { action: 'paste_receipt' })
    }, 4000)
  }
})
