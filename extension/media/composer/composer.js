(function () {
  const vscode = acquireVsCodeApi();

  const input = document.getElementById('composer-input');
  const saveBtn = document.getElementById('save-button');
  const publishBtn = document.getElementById('publish-button');
  const cancelBtn = document.getElementById('cancel-button');
  const severityBtn = document.getElementById('severity-button');

  function setButtonsEnabled(hasText) {
    saveBtn.disabled = !hasText;
    publishBtn.disabled = !hasText;
  }

  function autoResize() {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 400) + 'px';
  }

  input.addEventListener('input', () => {
    const text = input.value;
    setButtonsEnabled(text.trim().length > 0);
    autoResize();
    vscode.postMessage({ type: 'textChange', text });
  });

  input.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'Enter') {
      e.preventDefault();
      if (!publishBtn.disabled) {
        vscode.postMessage({ type: 'publish', text: input.value });
      }
    } else if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'Enter') {
      e.preventDefault();
      if (!saveBtn.disabled) {
        vscode.postMessage({ type: 'save', text: input.value });
      }
    } else if (e.key === 'Escape') {
      vscode.postMessage({ type: 'cancel' });
    }
  });

  saveBtn.addEventListener('click', () => {
    vscode.postMessage({ type: 'save', text: input.value });
  });

  publishBtn.addEventListener('click', () => {
    vscode.postMessage({ type: 'publish', text: input.value });
  });

  cancelBtn.addEventListener('click', () => {
    vscode.postMessage({ type: 'cancel' });
  });

  severityBtn.addEventListener('click', () => {
    vscode.postMessage({ type: 'cycleSeverity' });
  });

  window.addEventListener('message', (event) => {
    const message = event.data;
    switch (message.type) {
      case 'init':
        input.value = message.text ?? '';
        setButtonsEnabled(input.value.trim().length > 0);
        severityBtn.textContent = message.severityLabel ?? '';
        severityBtn.setAttribute('data-severity', message.severity ?? '');
        if (message.fileName !== undefined) {
          const pathEl = document.querySelector('.header-path');
          if (pathEl) pathEl.textContent = message.fileName;
        }
        if (message.lineLabel !== undefined) {
          const lineEl = document.querySelector('.header-line');
          if (lineEl) lineEl.textContent = message.lineLabel;
        }
        if (message.isEdit !== undefined) {
          const actionEl = document.querySelector('.header-action');
          if (actionEl) actionEl.textContent = message.isEdit ? 'Edit comment' : 'New comment';
        }
        autoResize();
        input.focus();
        break;
      case 'severity':
        severityBtn.textContent = message.severityLabel ?? '';
        severityBtn.setAttribute('data-severity', message.severity ?? '');
        break;
    }
  });

  autoResize();
  vscode.postMessage({ type: 'ready' });
})();
