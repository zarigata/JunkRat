// TOILET SURF Helper Functions - Copy this entire block
// Paste BEFORE line 2531 in src/webview/chatScript.ts (before the closing })();)

// TOILET SURF Helper Functions
function updateAutonomousProgress(progress) {
    autonomousProgress = progress;
    if (toiletSurfIteration) {
        toiletSurfIteration.textContent = progress.currentIteration + '/' + progress.maxIterations;
    }
    if (toiletSurfTasks) {
        toiletSurfTasks.textContent = progress.completedTasks + '/' + progress.totalTasks + ' tasks';
    }
    if (toiletSurfProgressFill && progress.totalTasks > 0) {
        const percentage = (progress.completedTasks / progress.totalTasks) * 100;
        toiletSurfProgressFill.style.width = percentage + '%';
    }
    if (toiletSurfCombo && progress.comboMultiplier) {
        if (progress.comboMultiplier > 1.0) {
            toiletSurfCombo.style.display = 'inline';
            toiletSurfCombo.textContent = '🔥 ' + progress.comboMultiplier.toFixed(1) + 'x';
        } else {
            toiletSurfCombo.style.display = 'none';
        }
    }
    if (achievementsDisplay && progress.achievements && progress.achievements.length > 0) {
        achievementsDisplay.style.display = 'flex';
        achievementsDisplay.innerHTML = progress.achievements.map(function (achievement) {
            return '<span class="achievement-badge">' + achievement + '</span>';
        }).join('');
    }
}

function handleAutonomousComplete(result) {
    if (toiletSurfToggle) {
        toiletSurfToggle.checked = false;
        toiletSurfEnabled = false;
    }
    if (toiletSurfProgress) {
        toiletSurfProgress.style.display = 'none';
    }
    const message = result.success
        ? '🎉 TOILET SURF completed successfully in ' + result.iterations + ' iterations!'
        : '⚠️ TOILET SURF stopped after ' + result.iterations + ' iterations.';
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message assistant';
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    const textDiv = document.createElement('div');
    textDiv.className = 'message-text';
    textDiv.textContent = message;
    contentDiv.appendChild(textDiv);
    messageDiv.appendChild(contentDiv);
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    transitionToScreen('idle');
}

function updateUIPhaseIndicator(phase) {
    currentUIPhase = phase;
    if (uiPhaseIndicator) {
        uiPhaseIndicator.textContent = phase;
        uiPhaseIndicator.className = 'ui-phase-indicator phase-' + phase.toLowerCase();
    }
}

function updateProviderHealthStatus(payload) {
    providerHealthStatuses = payload.statuses || [];
}

function transitionToScreen(screenName) {
    currentScreen = screenName;
    const onboardingWizard = document.getElementById('onboarding-wizard');
    const emptyState = document.getElementById('empty-state');
    const toiletSurfContainer = document.getElementById('toilet-surf-container');
    const toiletSurfProgress = document.getElementById('toilet-surf-progress');
    const inputContainer = document.querySelector('.input-container');
    const phaseDashboard = document.getElementById('phase-dashboard');
    if (onboardingWizard) onboardingWizard.style.display = 'none';
    if (emptyState) emptyState.style.display = 'none';
    if (toiletSurfProgress) toiletSurfProgress.style.display = 'none';
    if (screenName === 'setup') {
        if (onboardingWizard) onboardingWizard.style.display = 'flex';
        if (toiletSurfContainer) toiletSurfContainer.style.display = 'none';
        if (inputContainer) inputContainer.style.display = 'none';
    } else if (screenName === 'idle') {
        if (messages.length === 0 && emptyState) {
            emptyState.style.display = 'flex';
        }
        if (toiletSurfContainer) toiletSurfContainer.style.display = 'flex';
        if (inputContainer) inputContainer.style.display = 'flex';
        if (phaseDashboard && currentPhasePlan) {
            phaseDashboard.style.display = 'flex';
        }
    } else if (screenName === 'active') {
        if (toiletSurfContainer) toiletSurfContainer.style.display = 'flex';
        if (toiletSurfProgress) toiletSurfProgress.style.display = 'flex';
        if (inputContainer) inputContainer.style.display = 'none';
    }
    setState();
}
