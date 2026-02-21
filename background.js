const STORAGE_KEY = 'maude_rules';

function loadRules() {
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

function urlMatchesRule(url, rule) {
  if (!rule.matcher) return false;
  try {
    if (rule.matcherMode === 'regex') {
      return new RegExp(rule.matcher).test(url);
    }
    return wildcardToRegex(rule.matcher).test(url);
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
      const blob = new Blob([code], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      const script = document.createElement('script');
      script.src = url;
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
          return !!eval(code);
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

function scheduleInjection(tabId, rule) {
  const delayMs = (rule.delaySeconds != null && rule.delaySeconds > 0)
    ? rule.delaySeconds * 1000
    : 0;
  const hasCondition = !!(rule.injectionCondition && rule.injectionCondition.trim());

  function doInject() {
    injectScript(tabId, rule.scriptContent || '');
  }

  function checkConditionThenInject() {
    runCondition(tabId, rule.injectionCondition).then((ok) => {
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

  const rules = await loadRules();
  for (const rule of rules) {
    if (urlMatchesRule(url, rule)) {
      scheduleInjection(tabId, rule);
    }
  }
}

chrome.tabs.onUpdated.addListener(onTabUpdated);
