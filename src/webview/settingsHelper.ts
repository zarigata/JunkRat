export function getSettingsHelperScript(): string {
  return `
    (function () {
      const vscode = acquireVsCodeApi();

      // Safe postMessage wrapper
      function safePostMessage(message) {
        try {
          vscode.postMessage(message);
        } catch (error) {
          console.error('Settings postMessage failed:', error, 'Message:', message);
        }
      }

      // Global error handler
      window.onerror = function(message, source, lineno, colno, error) {
        console.error('Settings webview error:', { message, source, lineno, colno, error });
        try {
          safePostMessage({
            type: 'webviewError',
            payload: {
              message: message,
              source: source,
              line: lineno,
              column: colno,
              stack: error ? error.stack : null
            }
          });
        } catch (e) {
          console.error('Failed to report error to extension:', e);
        }
        return false;
      };

      window.addEventListener('unhandledrejection', function(event) {
        console.error('Settings unhandled promise rejection:', event.reason);
        try {
          safePostMessage({
            type: 'webviewError',
            payload: {
              message: 'Unhandled Promise Rejection: ' + (event.reason?.message || event.reason),
              stack: event.reason?.stack || null
            }
          });
        } catch (e) {
          console.error('Failed to report promise rejection to extension:', e);
        }
      });

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
          providerList.innerHTML = '<div class="empty-state">' +
            '<div class="codicon codicon-gear"></div>' +
            '<p>No providers configured yet.</p>' +
            '<p>Open VS Code Settings to configure JunkRat providers.</p>' +
            '</div>';
          return;
        }

        providers.forEach((provider) => {
          const item = document.createElement('li');
          item.className = 'provider-status-item';
          item.innerHTML = '<div class="provider-info">' +
            '<span class="codicon codicon-robot"></span>' +
            '<div>' +
              '<div class="provider-name">' + provider.name + '</div>' +
              '<div class="status-badges">' + providerStatusBadges(provider) + '</div>' +
            '</div>' +
            '</div>' +
            '<div class="action-buttons">' +
              '<button class="action-button secondary" data-action="configure" data-provider="' + provider.id + '">' +
                '<span class="codicon codicon-settings"></span>' +
                'Configure' +
              '</button>' +
              '<button class="action-button" data-action="test" data-provider="' + provider.id + '">' +
                '<span class="codicon codicon-check"></span>' +
                'Test' +
              '</button>' +
            '</div>';

          providerList.appendChild(item);
        });
      }

      function handleAction(event) {
        try {
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
              safePostMessage({ type: 'openSettings', payload: { settingId: 'junkrat.' + providerId } });
              break;
            case 'test':
              target.disabled = true;
              target.classList.add('loading');
              safePostMessage({ type: 'testProvider', payload: { providerId } });
              break;
          }
        } catch (error) {
          console.error('Button action failed:', error);
        }
      }

      window.addEventListener('message', (event) => {
        try {
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
        } catch (error) {
          console.error('Message handler failed:', error);
        }
      });

      if (providerList) {
        providerList.addEventListener('click', handleAction);
      }

      if (validateAllButton) {
        validateAllButton.addEventListener('click', () => {
          try {
            safePostMessage({ type: 'validateAll' });
          } catch (error) { console.error('Validate all failed:', error); }
        });
      }

      if (openSettingsButton) {
        openSettingsButton.addEventListener('click', () => {
          try {
            safePostMessage({ type: 'openNativeSettings' });
          } catch (error) { console.error('Open settings failed:', error); }
        });
      }

      // Initial render
      renderValidationMessage(lastValidationMessage);
      renderProviders();

      // Notify host
      safePostMessage({ type: 'ready' });
      safePostMessage({ type: 'requestProviderStatus' });
    })();
  `;
}
