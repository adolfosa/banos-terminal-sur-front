$(document).ready(function () {
  const usuarioRaw = sessionStorage.getItem('usuario');
  const usuario = usuarioRaw ? JSON.parse(usuarioRaw) : null;

  console.log("Usuario:", usuario);

  if (usuario?.role === 'admin') {
    $('#btnAdmin').show(); // Solo mostrar si es admin
  }
  
  // Función para cargar y mostrar todas las cajas
  function cargarCaja() {
    const usuarioJSON = sessionStorage.getItem('usuario');
    const token = sessionStorage.getItem('authToken');

    if (!usuarioJSON || !token) {
      $('#infoCajaUser').html('');
      $('#tablaCaja tbody').html('<tr><td colspan="9" class="text-center text-danger">No hay sesión activa.</td></tr>');
      return;
    }

    const payload = parseJwt(token);
    if (!payload || !payload.id) {
      $('#infoCajaUser').html('');
      $('#tablaCaja tbody').html('<tr><td colspan="9" class="text-center text-danger">Token inválido.</td></tr>');
      return;
    }

    const id_usuario = payload.id;

    // ✅ 1. Mostrar caja abierta del sistema
    const numeroCaja = localStorage.getItem('numero_caja');
    if (!numeroCaja) return;

    $.get(`http://localhost:3000/api/caja/abierta?numero_caja=${numeroCaja}`, function (res) {

      if (!res.success) {
        $('#infoCajaUser').html('');
        return;
      }

      const c = res.caja;
      const fecha = new Date(c.fecha_apertura);
      const dia = String(fecha.getDate()).padStart(2, '0');
      const mes = String(fecha.getMonth() + 1).padStart(2, '0');
      const anio = fecha.getFullYear();
      const fechaFormateada = `${dia}-${mes}-${anio}`;

      const card = `
        <div class="card shadow-sm border-primary">
          <div class="card-body">
            <h5 class="card-title mb-2">Caja Abierta por: ${c.nombre_usuario}</h5>
            <p class="mb-1"><strong>N° Caja:</strong> ${c.numero_caja}</p>
            <p class="mb-1"><strong>Fecha:</strong> ${fechaFormateada} &nbsp; <strong>Hora:</strong> ${c.hora_apertura}</p>
          </div>
        </div>
      `;
      $('#infoCajaUser').html(card);
    }).fail(function () {
      $('#infoCajaUser').html('');
    });

    // ✅ 2. Mostrar movimientos por caja     
    $.get(`http://localhost:3000/api/caja/movimientos/por-caja?numero_caja=${numeroCaja}`, function (res) {

      if (!res.success || !res.movimientos.length) {
        $('#tablaCaja tbody').html('<tr><td colspan="9" class="text-center text-muted">No hay movimientos registrados.</td></tr>');
        return;
      }

      const filas = res.movimientos.map(m => {
        const fecha = new Date(m.fecha);
        const dia = String(fecha.getDate()).padStart(2, '0');
        const mes = String(fecha.getMonth() + 1).padStart(2, '0');
        const anio = fecha.getFullYear();
        const fechaFormateada = `${dia}-${mes}-${anio}`;

        return `
          <tr>
            <td>${m.id}</td>
            <td>${fechaFormateada}</td>
            <td>${m.hora}</td>
            <td>${m.nombre_servicio}</td>
            <td>${m.medio_pago}</td>
            <td>$${parseFloat(m.monto).toLocaleString()}</td>
            <td>${m.nombre_usuario}</td>            
          </tr>
        `;
      }).join('');

      $('#tablaCaja tbody').html(filas);
    }).fail(function () {
      $('#tablaCaja tbody').html('<tr><td colspan="9" class="text-center text-danger">Error al cargar movimientos.</td></tr>');
    });
  }

  // Helper para decodificar JWT
  function parseJwt(token) {
    try {
      const payload = token.split('.')[1];
      return JSON.parse(atob(payload));
    } catch (e) {
      return null;
    }
  }

  // Cargar cajas al iniciar
  cargarCaja();

  // Botón para actualizar la lista
  $('#btnActualizar').on('click', cargarCaja);

 $('#formInicioCaja').on('submit', function (e) {
    e.preventDefault();

    const monto = $('#monto_inicial_modal').val();
    const observaciones = $('#observaciones_modal').val();

    const token = sessionStorage.getItem('authToken');
    const usuarioJSON = sessionStorage.getItem('usuario');

    if (!token || !usuarioJSON) {
      alert('Sesión no válida. Vuelve a iniciar sesión.');
      sessionStorage.clear();
      window.location.href = '/login.html';
      return;
    }

    function parseJwt(token) {
      try {
        const payload = token.split('.')[1];
        return JSON.parse(atob(payload));
      } catch (err) {
        return null;
      }
    }

    const payload = parseJwt(token);
    if (!payload || !payload.id) {
      alert('Token inválido. Vuelve a iniciar sesión.');
      sessionStorage.clear();
      window.location.href = '/login.html';
      return;
    }

    const id_usuario_apertura = payload.id;

    if (!monto || isNaN(monto) || parseFloat(monto) <= 0) {
      alert('El monto inicial debe ser un número mayor a 0.');
      return;
    }

    $.post('http://localhost:3000/api/caja/abrir', {
      monto_inicial: monto,
      observaciones: observaciones,
      id_usuario_apertura: id_usuario_apertura
      }, function (res) {
      if (res.success) {
          localStorage.setItem('id_aperturas_cierres', res.id);
          localStorage.setItem('estado_caja', 'abierta');
          localStorage.setItem('numero_caja', res.numero_caja); 
          $('#modalInicio').modal('hide');
          alert('Caja abierta correctamente');
          $('#btnAbrirCaja').prop('disabled', true);
          cargarCaja(); 
      } else {
          if (res.error === 'Ya existe una caja abierta para este número.') {
              alert('La caja ya está abierta');
          } else {
              alert(res.error);
          }
      }
  });
  });

  $('#btnCerrarCaja').on('click', function () {
      const estadoCaja = localStorage.getItem('estado_caja');
      const idSesion = localStorage.getItem('id_aperturas_cierres');

      if (estadoCaja !== 'abierta' || !idSesion) {
          alert('No hay caja abierta para cerrar.');
          return;
      }

      // Decodificar JWT
      function parseJwt(token) {
          try {
              const base64Url = token.split('.')[1];
              const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
              const jsonPayload = decodeURIComponent(
                  atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
              );
              return JSON.parse(jsonPayload);
          } catch (err) {
              console.error('Token inválido:', err);
              return null;
          }
      }

      const token = sessionStorage.getItem('authToken');
      if (!token) {
          alert('Sesión no válida. Inicia sesión nuevamente.');
          sessionStorage.clear();
          window.location.href = '/login.html';
          return;
      }

      const payload = parseJwt(token);
      const id_usuario_cierre = payload?.id;

      if (!id_usuario_cierre || isNaN(id_usuario_cierre)) {
          alert('Usuario inválido para cerrar caja.');
          return;
      }

      // Confirmación opcional
      if (!confirm('¿Estás seguro de cerrar la caja actual?')) return;

      // Enviar solicitud al backend
      $.ajax({
          url: 'http://localhost:3000/api/caja/cerrar',
          type: 'POST',
          contentType: 'application/json',
          data: JSON.stringify({
              id_aperturas_cierres: parseInt(idSesion),
              id_usuario_cierre: parseInt(id_usuario_cierre),
              observaciones: 'Cierre manual desde interfaz'
          }),
          success: function (data) {
              if (data.success) {
                  // Limpiar estado de la caja
                  localStorage.removeItem('id_aperturas_cierres');
                  localStorage.removeItem('estado_caja');
                  localStorage.removeItem('numero_caja');

                  alert('Caja cerrada correctamente.');
                  $('#btnAbrirCaja').prop('disabled', false);
                  cargarCaja(); // actualiza interfaz
              } else {
                  alert(data.error || 'Error desconocido.');
              }
          },
          error: function (xhr, status, error) {
              alert('Error en el servidor: ' + error);
          }
      });
  });
  
//  $('#btnAdmin').on('click', function () {
//     window.location.href = 'admin-cajas.html';
//   });
  
    // Deshabilitar botón si la caja ya está abierta
    const estadoCaja = localStorage.getItem('estado_caja');
    if (estadoCaja === 'abierta') {
        $('#btnAbrirCaja').prop('disabled', true);
        alert('La caja ya está abierta.');
    }
  
  document.getElementById('btnVolver').addEventListener('click', () => {
    window.location.href = '/home.html';
  });

});