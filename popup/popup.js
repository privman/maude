(function () {
  const STORAGE_KEY = 'maude_rules';
  const ruleListEl = document.getElementById('rule-list');
  const formSection = document.getElementById('form-section');
  const formTitle = document.getElementById('form-title');
  const btnAdd = document.getElementById('btn-add');
  const btnImport = document.getElementById('btn-import');
  const btnCancel = document.getElementById('btn-cancel');
  const btnSave = document.getElementById('btn-save');
  const ruleName = document.getElementById('rule-name');
  const matcherMode = document.getElementById('matcher-mode');
  const matcherPattern = document.getElementById('matcher-pattern');
  const scriptEditor = document.getElementById('script-editor');
  const scriptFile = document.getElementById('script-file');
  const scriptUploadPreview = document.getElementById('script-upload-preview');
  const scriptUrl = document.getElementById('script-url');
  const delaySeconds = document.getElementById('delay-seconds');
  const injectionCondition = document.getElementById('injection-condition');
  const importSection = document.getElementById('import-section');
  const importUrlInput = document.getElementById('import-url');
  const importCancelBtn = document.getElementById('import-cancel');
  const importLoadBtn = document.getElementById('import-load');

  let rules = [];
  let editingId = null;

  function generateId() {
    return 'r' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
  }

  function getNextUnnamedIndex() {
    let max = 0;
    rules.forEach((r) => {
      const m = r.name.match(/^\(unnamed(?: (\d+))?\)$/);
      if (m) max = Math.max(max, m[1] ? parseInt(m[1], 10) : 1);
    });
    return max + 1;
  }

  function getDefaultName() {
    const n = getNextUnnamedIndex();
    return n === 1 ? '(unnamed)' : '(unnamed ' + n + ')';
  }

  function loadRules() {
    return new Promise((resolve) => {
      chrome.storage.local.get([STORAGE_KEY], (data) => {
        rules = data[STORAGE_KEY] || [];
        resolve();
      });
    });
  }

  function saveRules() {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [STORAGE_KEY]: rules }, resolve);
    });
  }

  function getCurrentTabUrl(cb) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].url) cb(tabs[0].url);
      else cb('');
    });
  }

  function renderRuleList() {
    ruleListEl.innerHTML = '';
    rules.forEach((rule) => {
      const li = document.createElement('li');
      li.className = 'rule-item';
      li.innerHTML = `
        <span class="name" title="${escapeHtml(rule.name)}">${escapeHtml(rule.name)}</span>
        <span class="pattern" title="${escapeHtml(rule.matcher)}">${escapeHtml(rule.matcher)}</span>
        <div class="actions">
          <button type="button" class="btn-icon edit" title="Edit" data-id="${escapeHtml(rule.id)}"><span class="material-icons">edit</span></button>
          <button type="button" class="btn-icon delete" title="Delete" data-id="${escapeHtml(rule.id)}"><span class="material-icons">delete</span></button>
        </div>
      `;
      li.querySelector('.edit').addEventListener('click', () => openForm(rule.id));
      li.querySelector('.delete').addEventListener('click', () => confirmDelete(rule.id));
      ruleListEl.appendChild(li);
    });
  }

  function escapeHtml(s) {
    const el = document.createElement('template');
    el.content.append(document.createTextNode(s));
    return el.innerHTML;
  }

  function setScriptSource(source) {
    document.querySelectorAll('.script-tabs .tab').forEach((t) => t.classList.toggle('active', t.dataset.source === source));
    document.querySelectorAll('.script-panel').forEach((p) => {
      p.classList.toggle('active', p.dataset.panel === source);
      p.classList.toggle('hidden', p.dataset.panel !== source);
    });
  }

  async function fetchManifestFormData(manifestUrl) {
    const url = manifestUrl.trim();
    if (!url) throw new Error('Enter a manifest URL');
    const res = await fetch(url);
    if (!res.ok) throw new Error('Manifest not found: ' + res.status);
    const manifest = await res.json();
    const base = url.replace(/\/[^/]*$/, '/');
    const matcher = manifest.matches || '*';
    const jsFile = manifest.js;
    let scriptContent = '';
    if (jsFile) {
      const scriptResourceUrl = jsFile.startsWith('http') ? jsFile : base + jsFile;
      const r = await fetch(scriptResourceUrl);
      if (!r.ok) throw new Error('Script not found: ' + jsFile);
      scriptContent = await r.text();
    }
    const delay = manifest.delaySeconds;
    return {
      name: manifest.name || 'Unnamed',
      matcherMode: manifest.matcherMode === 'regex' ? 'regex' : 'wildcard',
      matcher,
      scriptContent,
      delaySeconds: delay != null && delay !== '' ? String(delay) : '',
      injectionCondition: manifest.injectionCondition || '',
    };
  }

  function applyFormData(data) {
    ruleName.value = data.name;
    ruleName.placeholder = getDefaultName();
    matcherMode.value = data.matcherMode || 'wildcard';
    matcherPattern.value = data.matcher || '';
    scriptEditor.value = data.scriptContent || '';
    scriptUrl.value = '';
    scriptUploadPreview.textContent = '';
    scriptFile.value = '';
    delaySeconds.value = data.delaySeconds != null ? data.delaySeconds : '';
    injectionCondition.value = data.injectionCondition || '';
    setScriptSource('editor');
  }

  async function getScriptContentFromForm() {
    if (document.querySelector('.script-tabs .tab[data-source="url"]').classList.contains('active')) {
      const url = scriptUrl.value.trim();
      if (!url) return '';
      const r = await fetch(url);
      return r.text();
    }
    if (document.querySelector('.script-tabs .tab[data-source="upload"]').classList.contains('active')) {
      return scriptUploadPreview.textContent || '';
    }
    return scriptEditor.value;
  }

  function setScriptContentForEdit(rule) {
    setScriptSource('editor');
    scriptEditor.value = rule.scriptContent || '';
    scriptUrl.value = '';
    scriptUploadPreview.textContent = '';
    scriptFile.value = '';
  }

  function showRuleList() {
    ruleListEl.classList.remove('hidden');
    importSection.classList.add('hidden');
    formSection.classList.add('hidden');
  }

  function openForm(ruleId = null, options = null) {
    editingId = ruleId;
    ruleListEl.classList.add('hidden');
    importSection.classList.add('hidden');
    formSection.classList.remove('hidden');
    formTitle.textContent = ruleId ? 'Edit rule' : 'New rule';

    if (ruleId) {
      const rule = rules.find((r) => r.id === ruleId);
      if (!rule) return;
      ruleName.value = rule.name;
      matcherMode.value = rule.matcherMode || 'wildcard';
      matcherPattern.value = rule.matcher || '';
      delaySeconds.value = rule.delaySeconds != null && rule.delaySeconds !== '' ? rule.delaySeconds : '';
      injectionCondition.value = rule.injectionCondition || '';
      setScriptContentForEdit(rule);
    } else {
      ruleName.value = '';
      ruleName.placeholder = getDefaultName();
      matcherMode.value = 'wildcard';
      matcherPattern.value = '';
      scriptEditor.value = '';
      scriptUrl.value = '';
      scriptUploadPreview.textContent = '';
      scriptFile.value = '';
      delaySeconds.value = '';
      injectionCondition.value = '';
      setScriptSource('editor');
      if (options && options.importData) {
        applyFormData(options.importData);
      } else {
        getCurrentTabUrl((url) => {
          matcherPattern.value = url;
        });
      }
    }
  }

  function closeForm() {
    formSection.classList.add('hidden');
    editingId = null;
    showRuleList();
  }

  async function saveFromForm() {
    const name = ruleName.value.trim() || ruleName.placeholder || getDefaultName();
    const delay = delaySeconds.value === '' ? undefined : parseFloat(delaySeconds.value, 10);
    const data = {
      name,
      matcherMode: matcherMode.value,
      matcher: matcherPattern.value.trim(),
      delaySeconds: delay >= 0 ? delay : undefined,
      injectionCondition: injectionCondition.value.trim() || undefined,
    };

    try {
      data.scriptContent = await getScriptContentFromForm();
      if (editingId) {
        const rule = rules.find((r) => r.id === editingId);
        if (rule) Object.assign(rule, data);
      } else {
        rules.push({ id: generateId(), ...data });
      }
      saveRules();
      renderRuleList();
      closeForm();
    } catch (err) {
      alert('Failed to get script: ' + (err.message || err));
    }
  }

  function confirmDelete(ruleId) {
    const rule = rules.find((r) => r.id === ruleId);
    const name = rule ? rule.name : 'this rule';
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <p>Delete "${escapeHtml(name)}"?</p>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary modal-cancel">Cancel</button>
          <button type="button" class="btn btn-danger modal-confirm">Delete</button>
        </div>
      </div>
    `;
    const cancel = () => overlay.remove();
    overlay.querySelector('.modal-cancel').addEventListener('click', cancel);
    overlay.querySelector('.modal-confirm').addEventListener('click', () => {
      rules = rules.filter((r) => r.id !== ruleId);
      saveRules().then(() => {
        renderRuleList();
        overlay.remove();
      });
    });
    overlay.addEventListener('click', (e) => { if (e.target === overlay) cancel(); });
    document.body.appendChild(overlay);
  }

  // Tab clicks for script source
  document.querySelectorAll('.script-tabs .tab').forEach((tab) => {
    tab.addEventListener('click', () => setScriptSource(tab.dataset.source));
  });

  btnImport.addEventListener('click', () => {
    getCurrentTabUrl((url) => {
      importUrlInput.value = url || '';
      ruleListEl.classList.add('hidden');
      formSection.classList.add('hidden');
      importSection.classList.remove('hidden');
      importUrlInput.focus();
    });
  });

  importCancelBtn.addEventListener('click', () => {
    importSection.classList.add('hidden');
    showRuleList();
  });

  importLoadBtn.addEventListener('click', () => {
    const url = importUrlInput.value.trim();
    if (!url) {
      alert('Enter a manifest URL');
      return;
    }
    fetchManifestFormData(url)
      .then((data) => {
        importSection.classList.add('hidden');
        openForm(null, { importData: data });
      })
      .catch((err) => alert('Failed to load manifest: ' + (err.message || err)));
  });

  importUrlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      importLoadBtn.click();
    }
  });

  scriptFile.addEventListener('change', () => {
    const file = scriptFile.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      scriptUploadPreview.textContent = reader.result;
    };
    reader.readAsText(file);
  });

  btnAdd.addEventListener('click', () => openForm(null));
  btnCancel.addEventListener('click', closeForm);
  btnSave.addEventListener('click', saveFromForm);

  loadRules().then(() => {
    renderRuleList();
  });
})();
