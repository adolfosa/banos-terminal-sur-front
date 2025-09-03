$(document).ready(function () {
  const usuarioRaw = sessionStorage.getItem('usuario');
  const usuario = usuarioRaw ? JSON.parse(usuarioRaw) : null;

  console.log("Usuario:", usuario);
  
  // Función para calcular y mostrar totales
  function calcularTotales(movimientos, montoInicial = 0) {
      let totalEfectivo = 0;
      let totalTarjeta = 0;
      let totalRetiros = 0;
      
      movimientos.forEach(movimiento => {
          const monto = parseFloat(movimiento.monto) || 0;
          
          // Detectar retiros por el tipo de servicio o medio de pago
          const esRetiro = movimiento.tipo_servicio === 'RETIRO' || 
              (movimiento.medio_pago && movimiento.medio_pago.toLowerCase().includes('retiro')) ||
              (movimiento.nombre_servicio && movimiento.nombre_servicio.toLowerCase().includes('retiro'));
          
          if (esRetiro) {
              totalRetiros += Math.abs(monto); // Los retiros vienen como negativo
          } else if (movimiento.medio_pago && movimiento.medio_pago.toLowerCase().includes('efectivo')) {
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
      // CORRECCIÓN: El balance actual es el monto inicial + los ingresos en efectivo - los retiros
      const balanceActual = parseFloat(montoInicial) + totalEfectivo - totalRetiros;
      
      // Actualizar UI con formato chileno
      const montoInicialNum = parseFloat(montoInicial) || 0;
      $('#fondoInicial').text('$' + montoInicialNum.toLocaleString('es-CL'));
      $('#totalEfectivo').text('$' + totalEfectivo.toLocaleString('es-CL'));
      $('#totalTarjeta').text('$' + totalTarjeta.toLocaleString('es-CL'));
      $('#totalGeneral').text('$' + totalGeneral.toLocaleString('es-CL'));
      $('#balanceActual').text('$' + balanceActual.toLocaleString('es-CL'));
      
      // Mostrar total retirado si hay retiros
      if (totalRetiros > 0) {
          if ($('#totalRetirado').length === 0) {
              $('#resumenTotales').append(`
                  <div class="total-card retirado">
                      <div class="total-titulo">TOTAL RETIRADO</div>
                      <div class="total-valor" id="totalRetirado">$${totalRetiros.toLocaleString('es-CL')}</div>
                  </div>
              `);
          } else {
              $('#totalRetirado').text('$' + totalRetiros.toLocaleString('es-CL'));
          }
      } else if ($('#totalRetirado').length > 0) {
          $('#totalRetirado').parent().remove();
      }
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

            // En la función que crea las filas de la tabla, cambia:
            const filas = resMovimientos.movimientos.map(m => {
              const fecha = new Date(m.fecha);
              const dia = String(fecha.getDate()).padStart(2, '0');
              const mes = String(fecha.getMonth() + 1).padStart(2, '0');
              const anio = fecha.getFullYear();
              const fechaFormateada = `${dia}-${mes}-${anio}`;
              
              // Determinar clase CSS según el tipo de movimiento
              let claseMonto = 'monto';
              let montoMostrar = parseFloat(m.monto || 0);
              let simbolo = '';

              if ((m.medio_pago && m.medio_pago.toLowerCase().includes('retiro')) ||
                  (m.nombre_servicio && m.nombre_servicio.toLowerCase().includes('retiro'))) {
                claseMonto += ' retiro';
                simbolo = '-';
                montoMostrar = Math.abs(montoMostrar); // Valor absoluto para mostrar
              } else if (m.medio_pago && m.medio_pago.toLowerCase().includes('efectivo')) {
                claseMonto += ' efectivo';
              } else if (m.medio_pago && (
                m.medio_pago.toLowerCase().includes('tarjeta') || 
                m.medio_pago.toLowerCase().includes('débito') ||
                m.medio_pago.toLowerCase().includes('crédito')
              )) {
                claseMonto += ' tarjeta';
              }

              // ⭐⭐ CORRECCIÓN: Mostrar con el símbolo negativo ⭐⭐
              return `
                <tr>
                  <td>${m.id}</td>
                  <td>${fechaFormateada}</td>
                  <td>${m.hora}</td>
                  <td>${m.nombre_servicio}</td>
                  <td>${m.medio_pago}</td>
                  <td class="${claseMonto}">${simbolo}$${montoMostrar.toLocaleString('es-CL')}</td>
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
                  
                  // 🔹 LIMPIEZA DEL TOTAL RETIRADO (CORRECCIÓN)
                  if ($('#totalRetirado').length > 0) {
                      $('#totalRetirado').parent().remove();
                  }

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

  $('#btnRetiroEfectivo').on('click', function() {
    // Verificar que hay una caja abierta
    const estadoCaja = localStorage.getItem('estado_caja');
    if (estadoCaja !== 'abierta') {
      alert('Debe tener una caja abierta para realizar retiros.');
      return;
    }
    
    // Mostrar modal de autenticación primero
    $('#modalAuthAdmin').modal('show');
  });

    // Autenticación de administrador
    $('#formAuthAdmin').on('submit', function(e) {
      e.preventDefault();
      
      const username = $('#adminUsername').val();
      const password = $('#adminPassword').val();
      
      // Mostrar indicador de carga
      const submitBtn = $(this).find('button[type="submit"]');
      const originalText = submitBtn.text();
      submitBtn.prop('disabled', true).text('Verificando...');
      
      verificarAdmin(username, password)
        .then(esAdmin => {
          if (esAdmin) {
            $('#modalAuthAdmin').modal('hide');
            
            // CORREGIR: Parsear balance correctamente (formato chileno)
            const balanceText = $('#balanceActual').text().replace('$', '');
            const balanceActual = parseFloat(balanceText.replace(/\./g, '').replace(',', '.'));
            
            $('#balanceDisponible').text('$' + balanceActual.toLocaleString('es-CL'));
            $('#modalRetiro').modal('show');
            
            // Limpiar formulario
            $('#adminUsername').val('');
            $('#adminPassword').val('');
          } else {
            alert('Credenciales incorrectas o usuario no tiene permisos de administrador.');
          }
        })
        .catch(error => {
          console.error('Error en autenticación:', error);
          alert('Error al verificar credenciales: ' + error.message);
        })
        .finally(() => {
          // Restaurar botón
          submitBtn.prop('disabled', false).text(originalText);
        });
    });

  // Procesar retiro de efectivo
  $('#formRetiroEfectivo').on('submit', function(e) {
    e.preventDefault();
    
    // CORREGIR: Parsear monto correctamente (formato chileno)
    const monto = parseFloat($('#montoRetiro').val().replace(/\./g, '').replace(',', '.'));
    
    // CORREGIR: Parsear balance correctamente (formato chileno)
    const balanceText = $('#balanceActual').text().replace('$', '');
    const balanceActual = parseFloat(balanceText.replace(/\./g, '').replace(',', '.'));
    
    // Validaciones
    if (isNaN(monto) || monto <= 0) {
      alert('Ingrese un monto válido mayor a cero.');
      return;
    }
    
    if (monto > balanceActual) {
      alert('No puede retirar más del efectivo disponible. Disponible: $' + balanceActual.toLocaleString('es-CL') + ', Intenta retirar: $' + monto.toLocaleString('es-CL'));
      return;
    }
    
    // Confirmación final
    if (!confirm(`¿Está seguro de retirar $${monto.toLocaleString('es-CL')}?`)) {
      return;
    }
    
    // Realizar el retiro
    realizarRetiro(monto)
      .then(() => {
        alert('Retiro realizado exitosamente.');
        $('#modalRetiro').modal('hide');
        $('#formRetiroEfectivo')[0].reset();
        cargarCaja(); // Recargar datos
      })
      .catch(error => {
        console.error('Error en retiro:', error);
        alert('Error al procesar el retiro: ' + error.message);
      });
  });

  // Función para verificar administrador usando endpoint loginUser
  function verificarAdmin(username, password) {
    return new Promise((resolve, reject) => {
      const email = username; // Asumiendo que username es el email
      
      $.ajax({
        url: 'https://backend-banios.dev-wit.com/api/auth/loginUser',
        type: 'POST',
        contentType: 'application/json',
        dataType: 'json',
        data: JSON.stringify({ 
          email: email, 
          password: password 
        }),
        success: function(response) {
          console.log("Respuesta completa del login:", response); // Para debugging
          
          // Verificar si el login fue exitoso y tiene user con role
          if (response.message === "Login exitoso" && response.user && response.user.role) {
            // Verificar si el usuario tiene role de admin
            const esAdmin = response.user.role.toLowerCase() === 'admin';
            console.log("Es admin:", esAdmin, "Role:", response.user.role); // Para debugging
            resolve(esAdmin);
          } else {
            console.log("Login fallido o sin user role");
            resolve(false);
          }
        },
        error: function(xhr, status, error) {
          console.error('Error en verificación de admin:', error, "Status:", xhr.status);
          if (xhr.status === 401) {
            resolve(false); // Credenciales incorrectas
          } else {
            reject(new Error('Error de conexión: ' + error));
          }
        }
      });
    });
  }

  // Función para realizar el retiro
  function realizarRetiro(monto, motivo, comprobante) {
    return new Promise((resolve, reject) => {
      const token = sessionStorage.getItem('authToken');
      
      // Obtener ID de usuario del token
      const payload = parseJwt(token);
      const idUsuario = payload.id;
      
      $.ajax({
        url: 'http://localhost:3000/api/caja/retiros',
        type: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        data: JSON.stringify({
          monto: monto,
          motivo: motivo,
          id_usuario: idUsuario
        }),
        success: function(response) {
          if (response.success) {
            resolve(response);
          } else {
            reject(new Error(response.message || 'Error en el retiro'));
          }
        },
        error: function(xhr, status, error) {
          reject(new Error('Error del servidor: ' + error));
        }
      });
    });
  }
  
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