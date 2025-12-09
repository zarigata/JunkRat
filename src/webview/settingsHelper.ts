export function getSettingsHelperScript(): string {
  return `
    (function () {
      const vscode = acquireVsCodeApi();

      let providers = [];
      let validationResults = {};
      let lastValidationMessage = null;

      const previousState = vscode.getState();
      if (previousState) {
        providers = previousState.providers || [];
        validationResults = previousState.validationResults || {};
        lastValidationMessage = previousState.lastValidationMessage || null;
      }

      const providerList = document.getElementById('provider-status-list');
      const validationBanner = document.getElementById('validation-banner');
      const validationText = document.getElementById('validation-text');
      const validateAllButton = document.getElementById('validate-all-button');
      const openSettingsButton = document.getElementById('open-settings-button');

      function setState() {
        vscode.setState({ providers, validationResults, lastValidationMessage });
      }

      function renderValidationMessage(message) {
        if (!validationBanner || !validationText) {
          return;
        }

        if (!message) {
          validationBanner.style.display = 'none';
          return;
        }

        validationBanner.style.display = 'block';
        validationBanner.className = 'validation-message ' + message.severity;
        validationText.textContent = message.text;
      }

      function providerStatusBadges(provider) {
        const badges = [];

        if (provider.enabled) {
          badges.push('<span class="status-badge enabled">Enabled</span>');
        } else {
          badges.push('<span class="status-badge disabled">Disabled</span>');
        }

        const validation = validationResults[provider.id];
        if (validation) {
          if (validation.valid) {
            badges.push('<span class="status-badge valid">Valid</span>');
          } else {
            badges.push('<span class="status-badge invalid">Invalid</span>');
          }

          if (validation.warnings && validation.warnings.length > 0) {
            badges.push('<span class="status-badge warning">Warnings</span>');
          }
        }

        if (provider.available) {
          badges.push('<span class="status-badge enabled">Available</span>');
        } else if (provider.enabled) {
          badges.push('<span class="status-badge warning">Unavailable</span>');
        }

        return badges.join('');
      }

      function renderProviders() {
        if (!providerList) {
          return;
        }

        providerList.innerHTML = '';

        if (providers.length === 0) {
          providerList.innerHTML = \`
            <div class="empty-state">
              <div class="codicon codicon-gear"></div>
              <p>No providers configured yet.</p>
              <p>Open VS Code Settings to configure JunkRat providers.</p>
            </div>
          \`;
          return;
        }

        providers.forEach((provider) => {
          const item = document.createElement('li');
          item.className = 'provider-status-item';
          item.innerHTML = \`
            <div class="provider-info">
              <span class="codicon codicon-robot"></span>
              <div>
                <div>\${provider.name}</div>
                <div class="status-badges">\${providerStatusBadges(provider)}</div>
              </div>
            </div>
            <div class="action-buttons">
              <button class="action-button secondary" data-action="configure" data-provider="\${provider.id}">
                <span class="codicon codicon-settings"></span>
                Configure
              </button>
              <button class="action-button" data-action="test" data-provider="\${provider.id}">
                <span class="codicon codicon-check"></span>
                Test
              </button>
            </div>
          \`;

          providerList.appendChild(item);
        });
      }

      function handleAction(event) {
        const target = event.target.closest('button[data-action]');
        if (!target) {
          return;
        }

        const action = target.getAttribute('data-action');
        const providerId = target.getAttribute('data-provider');
        if (!action || !providerId) {
          return;
        }

        switch (action) {
          case 'configure':
            vscode.postMessage({ type: 'openSettings', payload: { settingId: 'junkrat.' + providerId } });
            break;
          case 'test':
            target.disabled = true;
            target.classList.add('loading');
            vscode.postMessage({ type: 'testProvider', payload: { providerId } });
            break;
        }
      }

      window.addEventListener('message', (event) => {
        const message = event.data;

        switch (message.type) {
          case 'providerStatusUpdate':
            providers = message.payload.providers || [];
            validationResults = message.payload.validationResults || {};
            renderProviders();
            setState();
            break;
          case 'validationResult':
            lastValidationMessage = message.payload.message || null;
            validationResults = {
              ...validationResults,
              ...message.payload.validationResults,
            };
            renderValidationMessage(lastValidationMessage);
            renderProviders();
            setState();
            break;
        }
      });

      if (providerList) {
        providerList.addEventListener('click', handleAction);
      }

      if (validateAllButton) {
        validateAllButton.addEventListener('click', () => {
          vscode.postMessage({ type: 'validateAll' });
        });
      }

      if (openSettingsButton) {
        openSettingsButton.addEventListener('click', () => {
          vscode.postMessage({ type: 'openNativeSettings' });
        });
      }

      // Initial render
      renderValidationMessage(lastValidationMessage);
      renderProviders();

      // Notify host
      vscode.postMessage({ type: 'ready' });
      vscode.postMessage({ type: 'requestProviderStatus' });
    })();
  `;
}
