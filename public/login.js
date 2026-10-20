const form = document.querySelector('#login-form');
const message = document.querySelector('#login-message');
const next = new URLSearchParams(location.search).get('next');
const destination = ['/admin/control', '/admin/create'].includes(next) ? next : '/admin';

form.addEventListener('submit', async event => {
  event.preventDefault();
  message.textContent = '';
  const button = form.querySelector('button');
  button.disabled = true;
  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: form.username.value, password: form.password.value })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Accesso non riuscito.');
    location.assign(destination);
  } catch (error) {
    message.textContent = error.message || 'Connessione non riuscita.';
    button.disabled = false;
  }
});
