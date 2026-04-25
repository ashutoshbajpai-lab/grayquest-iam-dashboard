try {
  var s = localStorage.getItem('gq-theme');
  if (s === 'dark') document.documentElement.classList.add('dark');
} catch(e) {}
