$(document).ready(function () {
  const usuarioRaw = sessionStorage.getItem('usuario');
  const usuario = usuarioRaw ? JSON.parse(usuarioRaw) : null;

  console.log("Usuario:", usuario);
  
  // Función para calcular y mostrar totales
  function calcularTotales(movimientos, montoInicial = 0) {
    let totalEfectivo = 0;
    let totalTarjeta = 0;
    
    movimientos.forEach(movimiento => {
      const monto = parseFloat(movimiento.monto) || 0;
      
      if (movimiento.medio_pago && movimiento.medio_pago.toLowerCase().includes('efectivo')) {
        totalEfectivo += monto;
      } else if (movimiento.medio_pago && (
        movimiento.medio_pago.toLowerCase().includes('tarjeta') || 
        movimiento.medio_pago.toLowerCase().includes('débito') ||
        movimiento.medio_pago.toLowerCase().includes('crédito')
      )) {
        totalTarjeta += monto;
      }
    });
    
    const totalGeneral = totalEfectivo + totalTarjeta;
    const balanceActual = parseFloat(montoInicial) + totalEfectivo;
    
    // Actualizar la UI con los totales - asegurar que montoInicial sea un número
    const montoInicialNum = parseFloat(montoInicial) || 0;
    $('#fondoInicial').text('$' + montoInicialNum.toLocaleString());
    $('#totalEfectivo').text('$' + totalEfectivo.toLocaleString());
    $('#totalTarjeta').text('$' + totalTarjeta.toLocaleString());
    $('#totalGeneral').text('$' + totalGeneral.toLocaleString());
    $('#balanceActual').text('$' + balanceActual.toLocaleString());
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

  // Función para cargar y mostrar todas las cajas
  function cargarCaja() {
    const usuarioJSON = sessionStorage.getItem('usuario');
    const token = sessionStorage.getItem('authToken');

    if (!usuarioJSON || !token) {
      $('#infoCajaUser').html('');
      $('#tablaCaja tbody').html('<tr><td colspan="9" class="text-center text-danger">No hay sesión activa.</td></tr>');
      
      // Limpiar totales
      $('#fondoInicial').text('$0');
      $('#totalEfectivo').text('$0');
      $('#totalTarjeta').text('$0');
      $('#totalGeneral').text('$0');
      $('#balanceActual').text('$0');
      return;
    }

    const payload = parseJwt(token);
    if (!payload || !payload.id) {
      $('#infoCajaUser').html('');
      $('#tablaCaja tbody').html('<tr><td colspan="9" class="text-center text-danger">Token inválido.</td></tr>');
      
      // Limpiar totales
      $('#fondoInicial').text('$0');
      $('#totalEfectivo').text('$0');
      $('#totalTarjeta').text('$0');
      $('#totalGeneral').text('$0');
      $('#balanceActual').text('$0');
      return;
    }

    // ✅ 1. Obtener ID de apertura_cierre desde localStorage
    const idAperturaCierre = localStorage.getItem('id_aperturas_cierres');
    const numeroCaja = localStorage.getItem('numero_caja');
    
    if (!idAperturaCierre || !numeroCaja) {
      // Si no hay caja abierta, limpiar totales
      $('#fondoInicial').text('$0');
      $('#totalEfectivo').text('$0');
      $('#totalTarjeta').text('$0');
      $('#totalGeneral').text('$0');
      $('#balanceActual').text('$0');
      return;
    }

    // ✅ 2. Obtener detalles de la caja desde la API correcta CON TOKEN
    $.ajax({
      url: `https://backend-banios.dev-wit.com/api/aperturas-cierres/${idAperturaCierre}`,
      type: 'GET',
      headers: {
        'Authorization': 'Bearer ' + token
      },
      success: function(resCaja) {
        if (!resCaja || !resCaja.monto_inicial) {
          $('#infoCajaUser').html('');
          $('#fondoInicial').text('$0');
          return;
        }

        const c = resCaja;
        const fecha = new Date(c.fecha_apertura);
        const dia = String(fecha.getDate()).padStart(2, '0');
        const mes = String(fecha.getMonth() + 1).padStart(2, '0');
        const anio = fecha.getFullYear();
        const fechaFormateada = `${dia}-${mes}-${anio}`;

        // Asegurar que el monto inicial es un número válido
        const montoInicial = parseFloat(c.monto_inicial) || 0;

        // Obtener el usuario desde sessionStorage
        const usuario = JSON.parse(sessionStorage.getItem('usuario') || '{}');
        const nombreUsuario = usuario.username || 'Usuario';

        const card = `
          <div class="card shadow-sm border-primary">
            <div class="card-body">
              <h5 class="card-title mb-2">Caja Abierta por: ${nombreUsuario}</h5>
              <p class="mb-1"><strong>N° Caja:</strong> ${numeroCaja}</p>
              <p class="mb-1"><strong>Fecha:</strong> ${fechaFormateada} &nbsp; <strong>Hora:</strong> ${c.hora_apertura}</p>
              <p class="mb-0"><strong>Monto Inicial:</strong> $${montoInicial.toLocaleString()}</p>
            </div>
          </div>
        `;
        $('#infoCajaUser').html(card);

        // ✅ 3. Mostrar movimientos por caja     
        $.ajax({
          url: `http://localhost:3000/api/caja/movimientos/por-caja?numero_caja=${numeroCaja}`,
          type: 'GET',
          headers: {
            'Authorization': 'Bearer ' + token
          },
          success: function(resMovimientos) {
            if (!resMovimientos.success) {
              $('#tablaCaja tbody').html('<tr><td colspan="9" class="text-center text-danger">Error al cargar movimientos.</td></tr>');
              calcularTotales([], montoInicial);
              return;
            }

            if (!resMovimientos.movimientos || !resMovimientos.movimientos.length) {
              $('#tablaCaja tbody').html('<tr><td colspan="9" class="text-center text-muted">No hay movimientos registrados.</td></tr>');
              calcularTotales([], montoInicial);
              return;
            }

            const filas = resMovimientos.movimientos.map(m => {
              const fecha = new Date(m.fecha);
              const dia = String(fecha.getDate()).padStart(2, '0');
              const mes = String(fecha.getMonth() + 1).padStart(2, '0');
              const anio = fecha.getFullYear();
              const fechaFormateada = `${dia}-${mes}-${anio}`;
              
              // Determinar clase CSS según el medio de pago
              let claseMonto = 'monto';
              if (m.medio_pago && m.medio_pago.toLowerCase().includes('efectivo')) {
                claseMonto += ' efectivo';
              } else if (m.medio_pago && (
                m.medio_pago.toLowerCase().includes('tarjeta') || 
                m.medio_pago.toLowerCase().includes('débito') ||
                m.medio_pago.toLowerCase().includes('crédito')
              )) {
                claseMonto += ' tarjeta';
              }

              return `
                <tr>
                  <td>${m.id}</td>
                  <td>${fechaFormateada}</td>
                  <td>${m.hora}</td>
                  <td>${m.nombre_servicio}</td>
                  <td>${m.medio_pago}</td>
                  <td class="${claseMonto}">$${parseFloat(m.monto || 0).toLocaleString()}</td>
                  <td>${m.nombre_usuario}</td>            
                </tr>
              `;
            }).join('');

            $('#tablaCaja tbody').html(filas);
            
            // Calcular y mostrar totales
            calcularTotales(resMovimientos.movimientos, montoInicial);
          },
          error: function() {
            $('#tablaCaja tbody').html('<tr><td colspan="9" class="text-center text-danger">Error al cargar movimientos.</td></tr>');
            calcularTotales([], montoInicial);
          }
        });
      },
      error: function() {
        $('#infoCajaUser').html('');
        $('#fondoInicial').text('$0');
        $('#totalEfectivo').text('$0');
        $('#totalTarjeta').text('$0');
        $('#totalGeneral').text('$0');
        $('#balanceActual').text('$0');
      }
    });
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
                        $('#btnCerrarCaja').prop('disabled', false);
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

      if (!confirm('¿Estás seguro de cerrar la caja actual?')) return;

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
              // 🔹 Limpiar estado de la caja
              localStorage.removeItem('id_aperturas_cierres');
              localStorage.removeItem('estado_caja');
              localStorage.removeItem('numero_caja');

              // 🔹 Limpiar datos de la interfaz
              $('#infoCajaUser').html('');
              $('#tablaCaja tbody').html('<tr><td colspan="9" class="text-center text-muted">Caja cerrada. No hay movimientos.</td></tr>');
              
              // 🔹 Limpiar totales (NUEVO CÓDIGO)
              $('#fondoInicial').text('$0');
              $('#totalEfectivo').text('$0');
              $('#totalTarjeta').text('$0');
              $('#totalGeneral').text('$0');
              $('#balanceActual').text('$0');

              // 🔹 Desactivar botón de cerrar caja
              $('#btnCerrarCaja').prop('disabled', true);

              // 🔹 Habilitar abrir caja
              $('#btnAbrirCaja').prop('disabled', false);

              alert('Caja cerrada correctamente.');
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
    // Validar botones según estado de la caja al iniciar
    const estadoCaja = localStorage.getItem('estado_caja');
    if (estadoCaja === 'abierta') {
        $('#btnAbrirCaja').prop('disabled', true);
        $('#btnCerrarCaja').prop('disabled', false);
    } else {
        $('#btnAbrirCaja').prop('disabled', false);
        $('#btnCerrarCaja').prop('disabled', true);
    }
  
  document.getElementById('btnVolver').addEventListener('click', () => {
    window.location.href = '/home.html';
  });

});