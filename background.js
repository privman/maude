const STORAGE_KEY = 'maudes';

function loadMaudes() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (data) => {
      resolve(data[STORAGE_KEY] || []);
    });
  });
}

function wildcardToRegex(pattern) {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\?/g, '.')
    .replace(/\*/g, '.*');
  return new RegExp('^' + escaped + '$');
}

function urlMatchesMaude(url, maude) {
  if (!maude.matcher) return false;
  try {
    if (maude.matcherMode === 'regex') {
      return new RegExp(maude.matcher).test(url);
    }
    return wildcardToRegex(maude.matcher).test(url);
  } catch (_) {
    return false;
  }
}

function injectScript(tabId, scriptContent) {
  if (!scriptContent.trim()) return Promise.resolve();

  return chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: (code) => {
      const policy = trustedTypes.createPolicy('maude', { createScript: (s) => s });
      const script = document.createElement('script');
      script.textContent = policy.createScript(code);
      document.documentElement.appendChild(script);
    },
    args: [scriptContent],
  });
}

async function runCondition(tabId, conditionCode) {
  if (!conditionCode || !conditionCode.trim()) return true;

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: (code) => {
        try {
          const policy = trustedTypes.createPolicy('maude', { createScript: (s) => s });
          return !!eval(policy.createScript(code));
        } catch (_) {
          return false;
        }
      },
      args: [conditionCode],
    });
    return results && results[0] && results[0].result === true;
  } catch (_) {
    return false;
  }
}

function scheduleInjection(tabId, maude) {
  const delayMs = (maude.delaySeconds != null && maude.delaySeconds > 0)
    ? maude.delaySeconds * 1000
    : 0;
  const hasCondition = !!(maude.injectionCondition && maude.injectionCondition.trim());

  function doInject(content = maude.scriptContent) {
    injectScript(tabId, content);
  }

  function checkConditionThenInject() {
    runCondition(tabId, maude.injectionCondition).then((ok) => {
      if (ok) {
        doInject();
      } else if (delayMs > 0) {
        setTimeout(checkConditionThenInject, delayMs);
      }
    });
  }

  if (!hasCondition) {
    if (delayMs > 0) {
      setTimeout(doInject, delayMs);
    } else {
      doInject();
    }
    return;
  }

  if (delayMs > 0) {
    setTimeout(checkConditionThenInject, delayMs);
  } else {
    checkConditionThenInject();
  }
}

async function onTabUpdated(tabId, changeInfo, tab) {
  if (changeInfo.status !== 'complete' || !tab.url) return;
  const url = tab.url;
  if (url.startsWith('chrome://') || url.startsWith('chrome-extension://')) return;

  const maudes = await loadMaudes();
  for (const maude of maudes) {
    if (urlMatchesMaude(url, maude)) {
      scheduleInjection(tabId, maude);
    }
  }
}

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});

let panelTabId = null;
let panelPort = null;
let panelUrl = null;

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'maude-panel') return;
  panelPort = port;
  if (panelUrl != null) port.postMessage({ type: 'pageUrl', url: panelUrl });
  port.onDisconnect.addListener(() => {
    panelPort = null;
  });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'pageUrl' && sender.tab && sender.tab.id === panelTabId) {
    panelUrl = msg.url || null;
    if (panelPort) panelPort.postMessage({ type: 'pageUrl', url: panelUrl });
  }
});

const URL_NOTIFIER_MAIN =
  '(function(){function notify(){document.dispatchEvent(new CustomEvent("maude-url-change",{detail:location.href}));}notify();var origPush=history.pushState,origReplace=history.replaceState;history.pushState=function(){origPush.apply(this,arguments);notify();};history.replaceState=function(){origReplace.apply(this,arguments);notify();};window.addEventListener("popstate",notify);window.addEventListener("hashchange",notify);})();';

function runUrlNotifierIsolated() {
  function sendUrl(u) {
    try {
      if (chrome.runtime?.id) chrome.runtime.sendMessage({ type: 'pageUrl', url: u || location.href });
    } catch (_) {}
  }
  sendUrl(location.href);
  document.addEventListener('maude-url-change', (e) => sendUrl(e.detail));
}

chrome.action.onClicked.addListener((tab) => {
  panelTabId = tab.id;
  panelUrl = tab.url || null;
  chrome.sidePanel.open({ windowId: tab.windowId });
  injectScript(tab.id, URL_NOTIFIER_MAIN).then(() => {
    return chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'ISOLATED',
      func: runUrlNotifierIsolated,
    });
  }).catch(() => {});
});

chrome.tabs.onUpdated.addListener(onTabUpdated);
