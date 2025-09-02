$(document).ready(function () {
  const usuarioRaw = sessionStorage.getItem('usuario');
  const usuario = usuarioRaw ? JSON.parse(usuarioRaw) : null;

  console.log("Usuario:", usuario);
  
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

    // Función para obtener el número de caja desde el backend local
    function obtenerNumeroCaja() {
        return new Promise((resolve, reject) => {
            $.ajax({
                url: 'http://localhost:3000/api/numero-caja',
                type: 'GET',
                success: function(data) {
                    if (data && data.numero_caja !== undefined) {
                        resolve(data.numero_caja);
                    } else {
                        reject('Número de caja no disponible');
                    }
                },
                error: function(error) {
                    reject('Error al obtener número de caja: ' + error.statusText);
                }
            });
        });
    }

    // Función principal para abrir la caja
    async function abrirCaja() {
        try {
            // Obtener número de caja
            const numero_caja = await obtenerNumeroCaja();
            
            // Obtener fecha y hora actual
            const now = new Date();
            const fecha_apertura = now.toISOString().split('T')[0];
            const hora_apertura = now.toTimeString().split(' ')[0];

            // Hacer la petición para abrir la caja
            $.ajax({
                url: 'http://localhost:3000/api/caja/abrir',
                type: 'POST',
                data: {
                    numero_caja: numero_caja,
                    id_usuario_apertura: id_usuario_apertura,
                    fecha_apertura: fecha_apertura,
                    hora_apertura: hora_apertura,
                    monto_inicial: monto,
                    observaciones: observaciones,
                    estado: 'abierta'
                },
                headers: {
                    'Authorization': 'Bearer ' + token
                },
                success: function(res) {
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
                },
                error: function(error) {
                    console.error('Error en la petición:', error);
                    if (error.status === 400) {
                        alert('Datos incompletos: ' + error.responseJSON.error);
                    } else if (error.status === 401) {
                        alert('Sesión expirada. Por favor, inicie sesión nuevamente.');
                        sessionStorage.clear();
                        window.location.href = '/login.html';
                    } else if (error.status === 500) {
                        alert('Error del servidor: ' + error.responseJSON.error);
                    } else {
                        alert('Error al conectar con el servidor');
                    }
                }
            });

        } catch (error) {
            console.error('Error:', error);
            alert(error);
        }
    }

    // Ejecutar la función principal
    abrirCaja();
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
  
    // Deshabilitar botón si la caja ya está abierta
    const estadoCaja = localStorage.getItem('estado_caja');
    if (estadoCaja === 'abierta') {
      $('#btnAbrirCaja').prop('disabled', true);
    }
  
  document.getElementById('btnVolver').addEventListener('click', () => {
    window.location.href = '/home.html';
  });

});