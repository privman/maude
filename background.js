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
chrome.tabs.onUpdated.addListener(onTabUpdated);

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'getCurrentTabUrl' && sender.id === chrome.runtime.id) {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      const url = tabs[0] && tabs[0].url ? tabs[0].url : '';
      sendResponse(url);
    });
    return true;
  }
});
