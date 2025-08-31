// This entire script should be in a file like 'app.js' or 'client.js'
// and included in your HTML: <script src="app.js" defer></script>

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM ELEMENT SELECTIONS ---
    const dom = {
        // Auth Elements
        loginBtn: document.querySelector('.btn-login'),
        signupBtn: document.querySelector('.btn-signup'),
        authModal: document.getElementById('authModal'),
        authForm: document.getElementById('auth-form'),
        authCloseBtn: document.querySelector('.auth-close-btn'),
        toggleAuthLink: document.getElementById('toggle-auth'),
        authModalTitle: document.getElementById('auth-modal-title'),
        authSubmitBtn: document.getElementById('auth-submit-btn'),
        authErrorMsg: document.getElementById('auth-error-msg'),
        authUsernameInput: document.getElementById('auth-username'),
        authPasswordInput: document.getElementById('auth-password'),

        // Profile Elements
        profileMenu: document.getElementById('profileMenu'),
        profileUsername: document.getElementById('profileUsername'),
        logoutBtn: document.getElementById('logoutBtn'),

        // Progress Elements
        progressBar: document.getElementById('progressBar'),
        progressText: document.getElementById('progressText'),
        modulesContainer: document.querySelector('.modules-container'),

        // Completion Modal Elements
        completionModal: document.getElementById('completionModal'),
        completionModalTitle: document.getElementById('completion-modal-title'),
        completionModalText: document.getElementById('completion-modal-text'),
        completionCloseBtn: document.querySelector('.completion-close-btn')
    };

    // --- STATE ---
    let isLoginMode = true;
    let progress = { completedModules: 0, phaseProgress: {} };
    const totalModulesOverall = 23; // Hardcoded for simplicity

    // --- API & PROGRESS LOGIC ---

    const fetchAPI = async (endpoint, options = {}) => {
        try {
            const response = await fetch(endpoint, options);
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || `HTTP error! status: ${response.status}`);
            }
            return data;
        } catch (error) {
            console.error(`API Error on ${endpoint}:`, error);
            throw error;
        }
    };

    const saveProgress = async () => {
        const token = localStorage.getItem('userToken');
        if (!token) return;
        try {
            await fetchAPI('/api/progress/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ progress })
            });
        } catch (error) {
            console.error("Failed to save progress to server.");
        }
    };

    const loadProgress = async () => {
        const token = localStorage.getItem('userToken');
        if (!token) {
            applyProgressUI();
            return;
        }
        try {
            const data = await fetchAPI('/api/progress/load', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            progress = data.progress || { completedModules: 0, phaseProgress: {} };
        } catch (error) {
            console.error('Failed to load progress, logging out:', error);
            handleLogout();
        } finally {
            applyProgressUI();
        }
    };

    // --- UI UPDATE FUNCTIONS ---

    const updateProgressBar = () => {
        const completedCount = Object.keys(progress.phaseProgress || {}).length;
        const percentage = totalModulesOverall > 0 ? (completedCount / totalModulesOverall) * 100 : 0;
        if (dom.progressBar) dom.progressBar.style.width = `${percentage}%`;
        if (dom.progressText) dom.progressText.textContent = `${Math.round(percentage)}% Complete`;
    };

    const applyProgressUI = () => {
        let maxCompleted = 0;
        document.querySelectorAll('.module-card').forEach(card => {
            const moduleId = parseInt(card.dataset.module, 10);
            const isCompleted = progress.phaseProgress[`module_${moduleId}`];

            card.classList.toggle('completed', isCompleted);
            card.classList.remove('active', 'locked');
            
            const statusEl = card.querySelector('.module-status');
            const btnEl = card.querySelector('.complete-btn');

            if (isCompleted) {
                if (statusEl) statusEl.textContent = 'Completed';
                if (btnEl) btnEl.disabled = true;
                maxCompleted = Math.max(maxCompleted, moduleId);
            }
        });

        const nextModuleId = maxCompleted + 1;
        const nextCard = document.querySelector(`.module-card[data-module="${nextModuleId}"]`);
        
        if (nextCard) {
            nextCard.classList.add('active');
            const statusEl = nextCard.querySelector('.module-status');
            const btnEl = nextCard.querySelector('.complete-btn');
            if (statusEl) statusEl.textContent = 'Current';
            if (btnEl) btnEl.disabled = false;
        }

        document.querySelectorAll('.module-card').forEach(card => {
            const moduleId = parseInt(card.dataset.module, 10);
            if (moduleId > nextModuleId) {
                card.classList.add('locked');
                const statusEl = card.querySelector('.module-status');
                const btnEl = card.querySelector('.complete-btn');
                if (statusEl) statusEl.textContent = 'Locked';
                if (btnEl) btnEl.disabled = true;
            }
        });

        updateProgressBar();
    };

    const updateAuthUI = () => {
        const username = localStorage.getItem('username');
        const loggedIn = !!username;

        // CORRECTED: Added checks to prevent errors if elements don't exist
        if (dom.loginBtn) dom.loginBtn.style.display = loggedIn ? 'none' : 'flex';
        if (dom.signupBtn) dom.signupBtn.style.display = loggedIn ? 'none' : 'flex';
        if (dom.profileMenu) dom.profileMenu.style.display = loggedIn ? 'flex' : 'none';
        if (dom.profileUsername) dom.profileUsername.textContent = loggedIn ? `Hello, ${username}` : '';
    };

    const showModal = (modalElement) => {
        if (modalElement) modalElement.classList.add('is-visible');
    };

    const hideModal = (modalElement) => {
        if (modalElement) modalElement.classList.remove('is-visible');
    };

    const setupAuthModal = (isLogin) => {
        isLoginMode = isLogin;
        if (dom.authModalTitle) dom.authModalTitle.textContent = isLogin ? 'Log In' : 'Sign Up';
        if (dom.authSubmitBtn) dom.authSubmitBtn.textContent = isLogin ? 'Log In' : 'Sign Up';
        if (dom.toggleAuthLink) dom.toggleAuthLink.textContent = isLogin ? "Don't have an account? Sign Up" : 'Already have an account? Log In';
        if (dom.authErrorMsg) dom.authErrorMsg.textContent = '';
        if (dom.authForm) dom.authForm.reset();
        showModal(dom.authModal);
    };

    // --- EVENT HANDLERS ---

    const handleAuthSubmit = async (e) => {
        e.preventDefault();
        const username = dom.authUsernameInput?.value?.trim();
        const password = dom.authPasswordInput?.value;
        if (!username || !password) {
            if (dom.authErrorMsg) dom.authErrorMsg.textContent = 'Please enter username and password.';
            return;
        }

        const endpoint = isLoginMode ? '/api/login' : '/api/signup';
        try {
            const data = await fetchAPI(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (isLoginMode) {
                localStorage.setItem('userToken', data.token);
                localStorage.setItem('username', data.username);
                updateAuthUI();
                hideModal(dom.authModal);
                await loadProgress();
            } else {
                setupAuthModal(true);
            }
        } catch (error) {
            if (dom.authErrorMsg) dom.authErrorMsg.textContent = error.message;
        }
    };
    
    const handleLogout = () => {
        localStorage.removeItem('userToken');
        localStorage.removeItem('username');
        progress = { completedModules: 0, phaseProgress: {} };
        updateAuthUI();
        applyProgressUI();
    };

    const handleCompleteModule = async (moduleIdStr) => {
        if (!localStorage.getItem('userToken')) {
            showModal(dom.authModal);
            return;
        }
        
        // CORRECTED: Ensure moduleId is a number
        const moduleId = parseInt(moduleIdStr, 10);
        if (isNaN(moduleId)) return; // Exit if moduleId is not a valid number

        progress.phaseProgress[`module_${moduleId}`] = true;
        applyProgressUI();
        
        if (dom.completionModalTitle) dom.completionModalTitle.textContent = `Level ${moduleId} Complete!`;
        if (dom.completionModalText) dom.completionModalText.textContent = "Great job! On to the next challenge.";
        showModal(dom.completionModal);

        await saveProgress();
    };

    // --- EVENT LISTENERS (ALL WRAPPED IN NULL CHECKS) ---
    if (dom.loginBtn) dom.loginBtn.addEventListener('click', () => setupAuthModal(true));
    if (dom.signupBtn) dom.signupBtn.addEventListener('click', () => setupAuthModal(false));
    if (dom.authCloseBtn) dom.authCloseBtn.addEventListener('click', () => hideModal(dom.authModal));
    if (dom.toggleAuthLink) {
        dom.toggleAuthLink.addEventListener('click', (e) => {
            e.preventDefault();
            setupAuthModal(!isLoginMode);
        });
    }
    if (dom.authForm) dom.authForm.addEventListener('submit', handleAuthSubmit);
    if (dom.logoutBtn) dom.logoutBtn.addEventListener('click', handleLogout);
    if (dom.completionCloseBtn) dom.completionCloseBtn.addEventListener('click', () => hideModal(dom.completionModal));
    
    if (dom.modulesContainer) {
        dom.modulesContainer.addEventListener('click', (e) => {
            const moduleHeader = e.target.closest('.module-header');
            const completeBtn = e.target.closest('.complete-btn');

            if (completeBtn) {
                const moduleId = completeBtn.dataset.module;
                handleCompleteModule(moduleId);
                return;
            }

            if (moduleHeader) {
                const card = moduleHeader.closest('.module-card');
                if (card && !card.classList.contains('locked')) {
                    card.classList.toggle('is-expanded');
                }
            }
        });
    }

    window.addEventListener('click', (e) => {
        if (e.target === dom.authModal) hideModal(dom.authModal);
        if (e.target === dom.completionModal) hideModal(dom.completionModal);
    });

    // --- INITIALIZATION ---
    updateAuthUI();
    loadProgress();
});