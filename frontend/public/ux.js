document.addEventListener('DOMContentLoaded', () => {
  const main = document.querySelector('main, #main-content, #content, .main-content, .login-page-wrap');
  if (main) {
    if (!main.id) main.id = 'main-content';
    main.tabIndex = -1;
    const skip = document.createElement('a');
    skip.className = 'skip-link';
    skip.href = `#${main.id}`;
    skip.textContent = 'Skip to content';
    skip.addEventListener('click', event => { event.preventDefault(); main.focus(); });
    document.body.prepend(skip);
  }

  function labelControls() {
    document.querySelectorAll('input, select, textarea').forEach(field => {
      if (field.type === 'hidden' || field.labels?.length || field.hasAttribute('aria-label')) return;
      const label = field.closest('.field, .form-group')?.querySelector('label');
      field.setAttribute('aria-label', label?.textContent.trim() || field.placeholder || field.name || 'Form field');
    });
    document.querySelectorAll('.nav-btn[data-page]').forEach(button => {
      if (button.classList.contains('active')) button.setAttribute('aria-current', 'page');
    });
  }
  labelControls();
  const modal = document.getElementById('modal');
  let previousFocus;
  if (modal) {
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'modal-title');
    const observer = new MutationObserver(() => {
      labelControls();
      if (modal.classList.contains('open')) {
        if (!modal.contains(document.activeElement)) {
          previousFocus = document.activeElement;
          modal.querySelector('input, select, button, [tabindex="0"]')?.focus();
        }
      } else if (previousFocus) {
        previousFocus.focus();
        previousFocus = null;
      }
    });
    observer.observe(modal, { attributes: true, attributeFilter: ['class'], childList: true, subtree: true });
    modal.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        if (modal.querySelector('#fpc-new')) return;
        modal.classList.remove('open');
        return;
      }
      if (event.key !== 'Tab') return;
      const controls = [...modal.querySelectorAll('button, input, select, textarea, a[href], [tabindex="0"]')].filter(control => !control.disabled && control.getClientRects().length);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    });
  }
  if (location.pathname.includes('/apps/demo')) {
    const banner = document.createElement('div');
    banner.id = 'workspace-mode';
    banner.textContent = 'Demo workspace · Tasks, CRM, analytics, automation, and file previews use sample data. Team management connects to the API when you sign in.';
    const content = document.getElementById('page-dashboard')?.parentElement;
    content?.prepend(banner);
  }
});
