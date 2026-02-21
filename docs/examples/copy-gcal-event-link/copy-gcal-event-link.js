function findPopup() {
    return Array.from(
      document.querySelector('div[role=dialog]').querySelectorAll("div")).find(el => el.hasAttribute('data-eventid'));
  }
  let lastPopup;
  setInterval(_ => {
    let popup = findPopup();
    if (popup && popup != lastPopup) {
      lastPopup = popup;
      let eventId = popup.getAttribute('data-eventid');
      let title =  popup.querySelector('span[role=heading]');
      let eventTimeRow = title.parentNode.parentNode.lastChild;
      let eventTime = eventTimeRow.innerText;
      let link = document.createElement('a');
      link.innerText = `${title.innerText} (${eventTime})`;
      link.href = `https://calendar.google.com/calendar/r?eid=${eventId}`;
      let clipboardItem = new ClipboardItem({
        'text/html': new Blob([link.outerHTML], { type: 'text/html' }),
        'text/plain': new Blob([link.href], { type: 'text/plain' })
      });
      let copyButton = document.createElement('span');
      copyButton.style.cursor = 'pointer';
      copyButton.style.fontFamily = 'Google Material Icons';
      copyButton.style.paddingLeft = '10px';
      copyButton.innerText = 'link';
      copyButton.addEventListener('click', _ => {
        navigator.clipboard.write([clipboardItem]);
        copyButton.innerText = 'copy_content';
        setTimeout(_ => {copyButton.innerText = 'link'}, 500);
      });
      eventTimeRow.append(copyButton);
    }
  }, 1000);
  