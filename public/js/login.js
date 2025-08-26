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

  // Manejo del enlace "Olvidé mi contraseña"
  const olvidoContrasena = document.getElementById('olvidoContrasena');
  if (olvidoContrasena) {
    olvidoContrasena.addEventListener('click', function(e) {
      e.preventDefault();
      // Mostrar modal para recuperar contraseña
      const modal = document.getElementById('modalRecuperar');
      if (modal) modal.style.display = 'flex';
    });
  }

  // Manejo del formulario de recuperación de contraseña
  const formRecuperar = document.getElementById('formRecuperar');
  if (formRecuperar) {
    formRecuperar.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const email = document.getElementById('emailRecuperar').value;
      
      try {
        const response = await fetch('http://localhost:4000/api/auth/forgot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });

        const result = await response.json();

        if (response.ok) {
          alert(result.message || 'Se ha enviado un correo para restablecer tu contraseña');
          const modal = document.getElementById('modalRecuperar');
          if (modal) modal.style.display = 'none';
          formRecuperar.reset();
        } else {
          alert(result.error || 'Error al procesar la solicitud');
        }
      } catch (err) {
        console.error('Error al recuperar contraseña:', err);
        alert('Ocurrió un error en el servidor');
      }
    });
  }

  // Cerrar modal al hacer clic en la X
  const closeModal = document.querySelector('.close');
  if (closeModal) {
    closeModal.addEventListener('click', function() {
      const modal = document.getElementById('modalRecuperar');
      if (modal) modal.style.display = 'none';
    });
  }

  // Cerrar modal al hacer clic fuera del contenido
  window.addEventListener('click', function(event) {
    const modal = document.getElementById('modalRecuperar');
    if (event.target === modal && modal) {
      modal.style.display = 'none';
    }
  });
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