chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'paste_receipt') {
    const tryPaste = (attempts = 0) => {
      const inputBox =
        document.querySelector('[contenteditable="true"][data-tab="10"]') ||
        document.querySelector('[contenteditable="true"][data-tab="1"]') ||
        document.querySelector('footer [contenteditable="true"]') ||
        document.querySelector('[role="textbox"]')

      if (inputBox) {
        inputBox.focus()
        document.execCommand('paste')
        inputBox.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'v',
          code: 'KeyV',
          ctrlKey: true,
          bubbles: true
        }))
      } else if (attempts < 10) {
        setTimeout(() => tryPaste(attempts + 1), 1000)
      }
    }
    tryPaste()
  }
})
