// ============================================
// ASSISTANT IA METIER
// ============================================

let assistantPendingAction = null;

const assistantDefaultSuggestions = [
    'Donne-moi les infos du client',
    'Quels clients ont un reste a payer ?',
    'Donne-moi les echeances du client',
    'Resume la caisse du jour'
];

function escapeAssistantText(value) {
    const text = value === null || value === undefined ? '' : String(value);
    if (typeof window.escapeHtml === 'function') return window.escapeHtml(text);
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function addAssistantMessage(role, text, options = {}) {
    const messages = document.getElementById('assistantMessages');
    if (!messages) return;

    const row = document.createElement('div');
    row.className = `assistant-message assistant-message-${role}`;

    const content = document.createElement('div');
    content.className = 'assistant-message-content';
    content.innerHTML = escapeAssistantText(text).replace(/\n/g, '<br>');
    row.appendChild(content);

    if (role === 'assistant' && Array.isArray(options.suggestions) && options.suggestions.length) {
        const suggestions = document.createElement('div');
        suggestions.className = 'assistant-suggestions';
        options.suggestions.slice(0, 6).forEach(suggestion => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'assistant-suggestion-btn';
            button.textContent = suggestion;
            button.addEventListener('click', function() {
                sendAssistantText(suggestion);
            });
            suggestions.appendChild(button);
        });
        row.appendChild(suggestions);
    }

    if (options.confirmationRequired) {
        const actions = document.createElement('div');
        actions.className = 'assistant-confirm-actions';
        actions.innerHTML = `
            <button class="btn-primary assistant-confirm-btn" type="button">Confirmer</button>
            <button class="btn-secondary assistant-cancel-btn" type="button">Annuler</button>
        `;
        row.appendChild(actions);

        actions.querySelector('.assistant-confirm-btn')?.addEventListener('click', confirmAssistantAction);
        actions.querySelector('.assistant-cancel-btn')?.addEventListener('click', function() {
            assistantPendingAction = null;
            addAssistantMessage('assistant', 'Action annulee.');
            actions.remove();
        });
    }

    messages.appendChild(row);
    messages.scrollTop = messages.scrollHeight;
}

function setAssistantLoading(isLoading) {
    const sendBtn = document.getElementById('assistantSendBtn');
    const input = document.getElementById('assistantInput');
    if (sendBtn) sendBtn.disabled = isLoading;
    if (input) input.disabled = isLoading;
}

function toggleAssistant() {
    const panel = document.getElementById('assistantPanel');
    if (!panel) return;

    panel.classList.toggle('show');
    if (panel.classList.contains('show')) {
        setTimeout(() => document.getElementById('assistantInput')?.focus(), 100);
    }
}

async function sendAssistantMessage(event) {
    event?.preventDefault();
    const input = document.getElementById('assistantInput');
    const message = input?.value.trim();
    if (!message) return;

    await sendAssistantText(message);
}

async function sendAssistantText(message) {
    const input = document.getElementById('assistantInput');
    const cleanMessage = String(message || '').trim();
    if (!cleanMessage) return;

    if (input) input.value = '';
    assistantPendingAction = null;
    addAssistantMessage('user', cleanMessage);
    setAssistantLoading(true);

    try {
        const response = await window.api.assistant.chat(cleanMessage);
        assistantPendingAction = response.action || null;
        addAssistantMessage('assistant', response.reply || 'Je n ai pas de reponse.', {
            suggestions: response.suggestions || [],
            confirmationRequired: Boolean(response.confirmationRequired && response.action)
        });
    } catch (error) {
        addAssistantMessage('assistant', error.message || 'Erreur assistant IA.');
        if (typeof window.showToast === 'function') {
            window.showToast('Erreur assistant IA', 'error');
        }
    } finally {
        setAssistantLoading(false);
        input?.focus();
    }
}

async function confirmAssistantAction() {
    if (!assistantPendingAction) {
        addAssistantMessage('assistant', 'Aucune action a confirmer.');
        return;
    }

    const action = assistantPendingAction;
    assistantPendingAction = null;
    setAssistantLoading(true);

    try {
        const response = await window.api.assistant.execute(action);
        addAssistantMessage('assistant', response.reply || 'Action effectuee.', {
            suggestions: response.suggestions || []
        });
        if (typeof window.showToast === 'function') {
            window.showToast('Action assistant effectuee', 'success');
        }

        if (typeof window.loadClients === 'function') window.loadClients();
        if (typeof window.loadRapports === 'function') window.loadRapports();
    } catch (error) {
        addAssistantMessage('assistant', error.message || 'Impossible d executer l action.');
        if (typeof window.showToast === 'function') {
            window.showToast('Erreur lors de l action assistant', 'error');
        }
    } finally {
        setAssistantLoading(false);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const toggle = document.getElementById('assistantToggle');
    const close = document.getElementById('assistantClose');
    const form = document.getElementById('assistantForm');

    toggle?.addEventListener('click', toggleAssistant);
    close?.addEventListener('click', toggleAssistant);
    form?.addEventListener('submit', sendAssistantMessage);

    addAssistantMessage('assistant', 'Choisis une question ou ecris directement ta demande.', {
        suggestions: assistantDefaultSuggestions
    });
});

window.toggleAssistant = toggleAssistant;
