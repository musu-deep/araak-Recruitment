(() => {
  'use strict';

  const endButton = document.getElementById('endSession');
  const shell = document.getElementById('shell');
  if (!endButton || !shell) return;

  const updateVisibility = () => {
    endButton.classList.toggle('hidden', shell.classList.contains('hidden'));
  };

  new MutationObserver(updateVisibility).observe(shell, { attributes: true, attributeFilter: ['class'] });
  updateVisibility();

  endButton.addEventListener('click', () => {
    const confirmed = window.confirm('سيتم إنهاء الجلسة وحذف المسودة المحفوظة على هذا الجهاز لحماية بياناتك. هل تريد المتابعة؟');
    if (!confirmed) return;

    ['araak-recruitment-draft-v4','araak-recruitment-draft-v3','araak-employment-draft-v1']
      .forEach(key => localStorage.removeItem(key));

    sessionStorage.clear();
    window.location.replace('/?session=ended');
  });
})();
