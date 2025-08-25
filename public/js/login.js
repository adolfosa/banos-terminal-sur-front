document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const logoutBtn = document.getElementById('logoutBtn');

  // Manejo del formulario de login
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;

      try {
        const response = await fetch('http://localhost:3000/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });

        const result = await response.json();

        if (response.ok) {
          // Guardar token y usuario en sessionStorage
          sessionStorage.setItem('authToken', result.token);
          sessionStorage.setItem('usuario', JSON.stringify(result.usuario));

          // Redirigir al home
          window.location.href = 'home.html';
        } else {
          alert(result.error || 'Error al iniciar sesión');
        }

      } catch (err) {
        console.error('Error al iniciar sesión:', err);
        alert('Ocurrió un error en el servidor');
      }
    });
  }

  // Manejo del botón de logout
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function (e) {
      e.preventDefault();
      cerrarSesion();
    });
  }
});

// Función para cerrar sesión
function cerrarSesion() {
  fetch('http://localhost:3000/api/logout')
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        sessionStorage.clear(); 
        window.location.href = '/login.html';
      } else {
        alert('No se pudo cerrar sesión correctamente.');
      }
    })
    .catch(err => {
      console.error('Error al cerrar sesión:', err);
      alert('Error al cerrar sesión.');
    });
}