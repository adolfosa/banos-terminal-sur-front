document.addEventListener("DOMContentLoaded", () => {
  // Cargar SweetAlert desde CDN
  const sweetAlertScript = document.createElement("script");
  sweetAlertScript.src = "https://cdn.jsdelivr.net/npm/sweetalert2@11";
  document.head.appendChild(sweetAlertScript);

  const loginForm = document.getElementById("loginForm");
  const logoutBtn = document.getElementById("logoutBtn");

  // Manejo del formulario de login
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const email = document.getElementById("email").value;
      const password = document.getElementById("password").value;

      try {
        const response = await fetch(
          "https://backend-banios.dev-wit.com/api/auth/loginUser",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
          }
        );

        const result = await response.json();

        if (response.ok) {
          // Guardar token y usuario en sessionStorage
          sessionStorage.setItem("authToken", result.token);
          sessionStorage.setItem("usuario", JSON.stringify(result.user));

          // Redirigir al home
          window.location.href = "home.html";
        } else {
          Swal.fire({
            icon: "error",
            title: "Error",
            text: result.error || "Error al iniciar sesión",
          });
        }
      } catch (err) {
        console.error("Error al iniciar sesión:", err);
        Swal.fire({
          icon: "error",
          title: "Error",
          text: "Ocurrió un error en el servidor",
        });
      }
    });
  }

  // Manejo del botón de logout
  if (logoutBtn) {
    logoutBtn.addEventListener("click", function (e) {
      e.preventDefault();
      cerrarSesion();
    });
  }

  // Manejo del enlace "Olvidé mi contraseña"
  const olvidoContrasena = document.getElementById("olvidoContrasena");
  if (olvidoContrasena) {
    olvidoContrasena.addEventListener("click", function (e) {
      e.preventDefault();
      // Mostrar modal para recuperar contraseña
      const modal = document.getElementById("modalRecuperar");
      if (modal) modal.style.display = "flex";
    });
  }

  // Manejo del formulario de recuperación de contraseña
  const formRecuperar = document.getElementById("formRecuperar");
  if (formRecuperar) {
    formRecuperar.addEventListener("submit", async function (e) {
      e.preventDefault();

      const email = document.getElementById("emailRecuperar").value;

      try {
        const response = await fetch(
          "https://backend-banios.dev-wit.com/api/auth/forgot",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email }),
          }
        );

        const result = await response.json();

        if (response.ok) {
          Swal.fire({
            icon: "success",
            title: "Éxito",
            text:
              result.message ||
              "Se ha enviado un correo para restablecer tu contraseña",
          });

          const modal = document.getElementById("modalRecuperar");
          if (modal) modal.style.display = "none";
          formRecuperar.reset();
        } else {
          Swal.fire({
            icon: "error",
            title: "Error",
            text: result.error || "Error al procesar la solicitud",
          });
        }
      } catch (err) {
        console.error("Error al recuperar contraseña:", err);
        Swal.fire({
          icon: "error",
          title: "Error",
          text: "Ocurrió un error en el servidor",
        });
      }
    });
  }

  // Cerrar modal al hacer clic en la X
  const closeModal = document.querySelector(".close");
  if (closeModal) {
    closeModal.addEventListener("click", function () {
      const modal = document.getElementById("modalRecuperar");
      if (modal) modal.style.display = "none";
    });
  }

  // Cerrar modal al hacer clic fuera del contenido
  window.addEventListener("click", function (event) {
    const modal = document.getElementById("modalRecuperar");
    if (event.target === modal && modal) {
      modal.style.display = "none";
    }
  });
});

function cerrarSesion() {
  console.log("🔔 Mock de cerrar sesión llamado");

  // Simular retraso como si fuera fetch real
  setTimeout(() => {
    const data = { success: true }; // Mock de respuesta

    if (data.success) {
      sessionStorage.clear();
      window.location.href = "/login.html";
    } else {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo cerrar sesión correctamente.",
      });
    }
  }, 200); // 200ms de delay para simular async
}
