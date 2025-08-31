// script.js
document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENT SELECTIONS ---
    const profileMenu = document.getElementById('profileMenu');
    const profileUsername = document.getElementById('profileUsername');
    const logoutBtn = document.getElementById('logoutBtn');

    const authModal = document.getElementById('authModal');
    const authForm = document.getElementById('auth-form');
    const loginBtn = document.querySelector('.btn-login');
    const signupBtn = document.querySelector('.btn-signup');
    const authCloseBtn = authModal ? authModal.querySelector('.auth-close-btn') : null;
    const toggleAuthLink = document.getElementById('toggle-auth');
    const authModalTitle = document.getElementById('auth-modal-title');
    const authSubmitBtn = document.getElementById('auth-submit-btn');
    const authErrorMsg = document.getElementById('auth-error-msg');
    const authUsernameInput = document.getElementById('auth-username');
    const authPasswordInput = document.getElementById('auth-password');

    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    const completionModal = document.getElementById('completionModal');
    const completionModalTitle = document.getElementById('completion-modal-title');
    const completionModalText = document.getElementById('completion-modal-text');
    const completionCloseBtn = document.querySelector('.completion-close-btn');

    const modulesContainer = document.querySelector('.modules-container');

    // --- STATE ---
    let isLoginMode = true;
    let userToken = localStorage.getItem('userToken') || null;
    let progress = { completedModules: 0, phaseProgress: {} };
    const phaseModules = { p1: 9, p2: 7, p3: 7 };
    const totalModulesOverall = Object.values(phaseModules).reduce((s, v) => s + v, 0);

    // --- AUTH MODAL ---
    const showAuthModal = (isLogin) => {
        isLoginMode = isLogin;
        if (authModalTitle) authModalTitle.textContent = isLogin ? 'Log In' : 'Sign Up';
        if (authSubmitBtn) authSubmitBtn.textContent = isLogin ? 'Log In' : 'Sign Up';
        if (toggleAuthLink) toggleAuthLink.textContent = isLogin ? "Don't have an account? Sign Up" : 'Already have an account? Log In';
        if (authErrorMsg) authErrorMsg.textContent = '';
        if (authForm) authForm.reset();

        if (authModal) {
            authModal.style.display = 'flex';
            requestAnimationFrame(() => { authModal.style.opacity = '1'; });
        }
    };

    const hideAuthModal = () => {
        if (!authModal) return;
        authModal.style.opacity = '0';
        const onEnd = (e) => {
            if (e.target === authModal) {
                authModal.style.display = 'none';
                authModal.removeEventListener('transitionend', onEnd);
            }
        };
        authModal.addEventListener('transitionend', onEnd);
    };

    // --- AUTH HANDLERS ---
    const handleAuthSubmit = async (e) => {
        e.preventDefault();
        const username = authUsernameInput?.value?.trim();
        const password = authPasswordInput?.value;
        if (!username || !password) {
            if (authErrorMsg) authErrorMsg.textContent = 'Please enter username and password.';
            return;
        }
        const url = isLoginMode ? '/api/login' : '/api/signup';
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Auth failed');

            if (isLoginMode) {
                // Save token + username
                userToken = data.token;
                localStorage.setItem('userToken', data.token);
                localStorage.setItem('username', data.username || username);
                updateUIAfterLogin();
                hideAuthModal();
                console.log('Logged in, token saved. Loading progress...');
                await loadProgress();
            } else {
                // Signup flow
                alert('Sign up successful! Please log in.');
                showAuthModal(true);
            }
        } catch (err) {
            console.error('Auth error:', err);
            if (authErrorMsg) authErrorMsg.textContent = err.message || 'Failed to connect to server';
        }
    };

    // --- PROGRESS HELPERS ---
    const updateProgressBar = () => {
        const completedCount = Object.keys(progress.phaseProgress || {}).length;
        const percentage = totalModulesOverall > 0 ? (completedCount / totalModulesOverall) * 100 : 0;
        if (progressBar) progressBar.style.width = `${percentage}%`;
        if (progressText) progressText.textContent = `${Math.round(percentage)}% Complete`;
    };

    const applyProgress = () => {
        // Lock all modules initially and disable buttons
        document.querySelectorAll('.module-card').forEach(card => {
            card.classList.add('locked');
            card.classList.remove('completed', 'active');
            const status = card.querySelector('.module-status');
            if (status) status.textContent = 'Locked';
            const btn = card.querySelector('.complete-btn');
            if (btn) btn.disabled = true;
        });

        // Mark completed modules (from saved progress)
        let maxCompleted = 0;
        if (progress.phaseProgress && typeof progress.phaseProgress === 'object') {
            Object.keys(progress.phaseProgress).forEach(key => {
                // expecting keys like "module_1"
                const parts = key.split('_');
                const id = parseInt(parts[1], 10);
                if (!isNaN(id)) {
                    maxCompleted = Math.max(maxCompleted, id);
                    const card = document.querySelector(`.module-card[data-module="${id}"]`);
                    if (card) {
                        card.classList.remove('locked', 'active');
                        card.classList.add('completed');
                        const status = card.querySelector('.module-status');
                        if (status) status.textContent = 'Completed';
                        const btn = card.querySelector('.complete-btn');
                        if (btn) btn.disabled = true;
                    }
                }
            });
        }

        // Unlock next module after last completed
        const nextModuleId = maxCompleted + 1;
        console.log('applyProgress -> maxCompleted:', maxCompleted, 'nextModuleId:', nextModuleId);
        const nextCard = document.querySelector(`.module-card[data-module="${nextModuleId}"]`);
        if (nextCard) {
            nextCard.classList.remove('locked');
            nextCard.classList.add('active');
            const status = nextCard.querySelector('.module-status');
            if (status) status.textContent = 'Current';
            const btn = nextCard.querySelector('.complete-btn');
            if (btn) btn.disabled = false;
        }

        updateProgressBar();
    };

    const saveProgressToServer = async (progressObj) => {
        const token = userToken || localStorage.getItem('userToken');
        if (!token) {
            console.warn('saveProgressToServer: no token');
            return false;
        }
        try {
            const res = await fetch('/api/progress/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ progress: progressObj })
            });
            const data = await res.json();
            if (!res.ok) {
                console.error('saveProgressToServer error:', data);
                return false;
            }
            console.log('saveProgressToServer success:', data);
            return true;
        } catch (err) {
            console.error('saveProgressToServer fetch error:', err);
            return false;
        }
    };

    const loadProgress = async () => {
        userToken = userToken || localStorage.getItem('userToken');
        if (!userToken) {
            console.log('loadProgress: no token, applying default UI');
            applyProgress();
            return;
        }
        try {
            const res = await fetch('/api/progress/load', {
                headers: { 'Authorization': `Bearer ${userToken}` }
            });
            if (!res.ok) {
                const err = await res.json().catch(()=>({}));
                throw new Error(err.message || 'Failed to load progress');
            }
            const data = await res.json();
            console.log('Loaded progress from server:', data);
            progress = data.progress || { completedModules: 0, phaseProgress: {} };
            applyProgress();
            return true;
        } catch (err) {
            console.error('loadProgress error:', err);
            // token may be invalid — clear it
            localStorage.removeItem('userToken');
            userToken = null;
            applyProgress();
            return false;
        }
    };

    // --- SCROLL UTILITY FUNCTION ---
    function scrollToLevel(levelNumber) {
        const level = document.querySelector(`.module-card[data-module="${levelNumber}"]`);
        if (level) {
            const y = level.getBoundingClientRect().top + window.scrollY - 100;
            window.scrollTo({ top: y, behavior: 'smooth' });
        }
    }

    // moduleId is numeric (1,2,3...), phaseId is text 'p1' etc
    const completeModule = async (moduleId, phaseId) => {
        // coerce to number
        const id = parseInt(moduleId, 10);
        if (isNaN(id)) {
            console.warn('completeModule called with invalid moduleId:', moduleId);
            return;
        }

        // If not logged in, block saving but still mark locally?
        if (!userToken && !localStorage.getItem('userToken')) {
            alert('Please log in to save your progress!');
            return;
        }

        // mark local progress
        progress.phaseProgress = progress.phaseProgress || {};
        progress.phaseProgress[`module_${id}`] = true;
        progress.completedModules = Object.keys(progress.phaseProgress).length;

        // update UI ASAP
        applyProgress();

        // save to server
        const ok = await saveProgressToServer(progress);
        if (!ok) {
            alert('Could not save progress to server. Progress updated locally.');
        } else {
            showCompletionModal(`Level ${id} Complete!`, 'Great job!');
            // Call the new scroll function
            const nextModuleId = id + 1;
            setTimeout(() => {
                scrollToLevel(nextModuleId);
            }, 500); // Wait for modal to appear before scrolling
        }
    };

    // --- COMPLETION MODAL ---
    const showCompletionModal = (title, text) => {
        if (completionModalTitle) completionModalTitle.textContent = title;
        if (completionModalText) completionModalText.textContent = text;
        if (completionModal) {
            completionModal.style.display = 'flex';
            requestAnimationFrame(()=>{ completionModal.style.opacity = '1'; });
        }
    };
    const hideCompletionModal = () => {
        if (!completionModal) return;
        completionModal.style.opacity = '0';
        const onEnd = (e) => {
            if (e.target === completionModal) {
                completionModal.style.display = 'none';
                completionModal.removeEventListener('transitionend', onEnd);
            }
        };
        completionModal.addEventListener('transitionend', onEnd);
    };

    // --- UI HELPERS ---
    const updateUIAfterLogin = () => {
        const username = localStorage.getItem('username');
        if (username) {
            if (loginBtn) loginBtn.style.display = 'none';
            if (signupBtn) signupBtn.style.display = 'none';
            if (profileMenu) {
                profileMenu.style.display = 'flex';
                profileUsername.textContent = `Hello, ${username}`;
            }
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('userToken');
        localStorage.removeItem('username');
        userToken = null;
        window.location.reload();
    };

    // --- EVENT LISTENERS ---
    if (loginBtn && signupBtn) {
        loginBtn.addEventListener('click', () => showAuthModal(true));
        signupBtn.addEventListener('click', () => showAuthModal(false));
    }
    if (authCloseBtn) authCloseBtn.addEventListener('click', hideAuthModal);
    if (toggleAuthLink) toggleAuthLink.addEventListener('click', (e) => { e.preventDefault(); showAuthModal(!isLoginMode); });
    if (authForm) authForm.addEventListener('submit', handleAuthSubmit);
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
    if (completionCloseBtn) completionCloseBtn.addEventListener('click', hideCompletionModal);

    // Delegated click handler for complete buttons and module-header toggles
    if (modulesContainer) {
        modulesContainer.addEventListener('click', (e) => {
            // Complete button (delegated)
            const btn = e.target.closest('.complete-btn');
            if (btn && modulesContainer.contains(btn)) {
                const moduleId = btn.dataset.module;
                const phaseId = btn.dataset.phase;
                console.log('Complete button clicked for module:', moduleId, 'phase:', phaseId);
                completeModule(moduleId, phaseId);
                return;
            }

            // Module header toggle (delegated)
            const header = e.target.closest('.module-header');
            if (header && modulesContainer.contains(header)) {
                const card = header.closest('.module-card');
                if (card && !card.classList.contains('locked')) {
                    const content = card.querySelector('.module-content');
                    if (!content) return;
                    const isVisible = getComputedStyle(content).display === 'block';
                    content.style.display = isVisible ? 'none' : 'block';
                }
                return;
            }
        });
    }

    // Close modals when clicking outside
    window.addEventListener('click', (event) => {
        if (authModal && event.target === authModal) hideAuthModal();
        if (completionModal && event.target === completionModal) hideCompletionModal();
    });

    // --- INITIAL LOAD ---
    updateUIAfterLogin();
    // Load progress if already logged in
    loadProgress().then(() => {
        console.log('Initial progress applied:', progress);
    }).catch(() => {/*ignored*/});

    console.log('Script loaded.');
});