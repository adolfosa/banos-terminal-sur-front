$(document).ready(function () {
  const usuarioRaw = sessionStorage.getItem('usuario');
  const usuario = usuarioRaw ? JSON.parse(usuarioRaw) : null;
  const sweetAlertScript = document.createElement('script');
  sweetAlertScript.src = 'https://cdn.jsdelivr.net/npm/sweetalert2@11';
  document.head.appendChild(sweetAlertScript);

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

      // Obtener usuario desde sessionStorage
      const usuarioRaw = sessionStorage.getItem('usuario');
      const usuario = usuarioRaw ? JSON.parse(usuarioRaw) : null;
      
      // Verificar si el usuario tiene rol de cajero
      if (!usuario || usuario.role.toLowerCase() !== 'cajero') {
          Swal.fire({
              icon: 'error',
              title: 'Permiso denegado',
              text: 'Solo los usuarios con rol "Cajero" pueden abrir caja.',
              confirmButtonText: 'Entendido'
          });
          return; // Detener la ejecución
      }

      const monto = $('#monto_inicial_modal').val();
      const observaciones = $('#observaciones_modal').val();

      const token = sessionStorage.getItem('authToken');
      const usuarioJSON = sessionStorage.getItem('usuario');

      if (!token || !usuarioJSON) {
          Swal.fire({
              icon: 'warning',
              title: 'Sesión inválida',
              text: 'Sesión no válida. Vuelve a iniciar sesión.'
          }).then(() => {
              sessionStorage.clear();
              window.location.href = '/login.html';
          });
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
          Swal.fire({
              icon: 'error',
              title: 'Token inválido',
              text: 'Token inválido. Vuelve a iniciar sesión.'
          }).then(() => {
              sessionStorage.clear();
              window.location.href = '/login.html';
          });
          return;
      }

      const id_usuario_apertura = payload.id;

      if (!monto || isNaN(monto) || parseFloat(monto) <= 0) {
          Swal.fire({
              icon: 'error',
              title: 'Monto inválido',
              text: 'El monto inicial debe ser un número mayor a 0.'
          });
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
                        // Almacenar los datos en localStorage
                        localStorage.setItem('id_aperturas_cierres', res.id);
                        localStorage.setItem('estado_caja', 'abierta');
                        localStorage.setItem('numero_caja', res.numero_caja);
                        localStorage.setItem('id_usuario_apertura', id_usuario_apertura); // ← AQUÍ SE AGREGA
                        
                        $('#modalInicio').modal('hide');
                        
                        Swal.fire({
                            icon: 'success',
                            title: '¡Caja abierta!',
                            text: 'Caja abierta correctamente',
                            timer: 2000,
                            showConfirmButton: false
                        });
                        
                        $('#btnAbrirCaja').prop('disabled', true);
                        $('#btnCerrarCaja').prop('disabled', false);
                        cargarCaja(); 
                    } else {
                        if (res.error === 'Ya existe una caja abierta para este número.') {
                            Swal.fire({
                                icon: 'warning',
                                title: 'Caja ya abierta',
                                text: 'La caja ya está abierta'
                            });
                        } else {
                            Swal.fire({
                                icon: 'error',
                                title: 'Error',
                                text: res.error
                            });
                        }
                    }
                },
                error: function(error) {
                    console.error('Error en la petición:', error);
                    if (error.status === 400) {
                        Swal.fire({
                            icon: 'error',
                            title: 'Datos incompletos',
                            text: 'Datos incompletos: ' + error.responseJSON.error
                        });
                    } else if (error.status === 401) {
                        Swal.fire({
                            icon: 'warning',
                            title: 'Sesión expirada',
                            text: 'Sesión expirada. Por favor, inicie sesión nuevamente.'
                        }).then(() => {
                            sessionStorage.clear();
                            window.location.href = '/login.html';
                        });
                    } else if (error.status === 500) {
                        Swal.fire({
                            icon: 'error',
                            title: 'Error del servidor',
                            text: 'Error del servidor: ' + error.responseJSON.error
                        });
                    } else {
                        Swal.fire({
                            icon: 'error',
                            title: 'Error de conexión',
                            text: 'Error al conectar con el servidor'
                        });
                    }
                }
            });

        } catch (error) {
            console.error('Error:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error inesperado',
                text: error.message || 'Ocurrió un error inesperado'
            });
        }
    }

    // Llamar a la función para abrir la caja
    abrirCaja();
  });

  $('#btnCerrarCaja').on('click', function () {
    const estadoCaja = localStorage.getItem('estado_caja');
    const idSesion = localStorage.getItem('id_aperturas_cierres');

    if (estadoCaja !== 'abierta' || !idSesion) {
      alert('No hay caja abierta para cerrar.');
      return;
    }

    // Mostrar modal de autenticación para cierre
    $('#modalAuthCierre').modal('show');
  });

  // Autenticación para cierre de caja
  $('#formAuthCierre').on('submit', function(e) {
    e.preventDefault();
    
    const username = $('#cierreUsername').val();
    const password = $('#cierrePassword').val();
    
    // Mostrar indicador de carga
    const submitBtn = $(this).find('button[type="submit"]');
    const originalText = submitBtn.text();
    submitBtn.prop('disabled', true).text('Verificando...');
    
    // Agregar 'cierre' como tercer parámetro
    verificarAdmin(username, password, 'cierre')
      .then(resultado => {
        if (resultado.esAutorizado) {
          // Guardar datos del usuario autorizado en sessionStorage
          sessionStorage.setItem('cierreAuth', JSON.stringify({
            id: resultado.userData.id,
            username: resultado.userData.username,
            email: resultado.userData.email,
            rol: resultado.rol,
            timestamp: new Date().getTime()
          }));
          
          $('#modalAuthCierre').modal('hide');
          
          // Mostrar mensaje de éxito
          Swal.fire({
            icon: 'success',
            title: 'Autenticación exitosa',
            text: 'Usuario autorizado correctamente.',
            timer: 1500,
            showConfirmButton: false
          }).then(() => {
            // Proceder con el cierre de caja después del mensaje
            realizarCierreCaja(resultado.userData.id);
          });
          
          // Limpiar formulario
          $('#cierreUsername').val('');
          $('#cierrePassword').val('');
        } else {
          Swal.fire({
            icon: 'error',
            title: 'Acceso denegado',
            text: resultado.mensaje || 'Credenciales incorrectas o usuario no tiene permisos para cerrar caja.'
          });
        }
      })
      .catch(error => {
        console.error('Error en autenticación:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error de autenticación',
          text: 'Error al verificar credenciales: ' + error.message
        });
      })
      .finally(() => {
        // Restaurar botón
        submitBtn.prop('disabled', false).text(originalText);
      });
  });

  // Función para realizar el cierre de caja después de la autenticación
  function realizarCierreCaja(idUsuarioCierre) {
    const estadoCaja = localStorage.getItem('estado_caja');
    const idSesion = localStorage.getItem('id_aperturas_cierres');
    const usuarioRaw = sessionStorage.getItem('usuario');
    const usuario = usuarioRaw ? JSON.parse(usuarioRaw) : null;
    const nombreCajero = usuario ? usuario.username : 'Cajero';

    if (estadoCaja !== 'abierta' || !idSesion) {
        Swal.fire({
            icon: 'warning',
            title: 'Caja no abierta',
            text: 'No hay caja abierta para cerrar.'
        });
        return;
    }

    const token = sessionStorage.getItem('authToken');
    if (!token) {
        Swal.fire({
            icon: 'error',
            title: 'Sesión inválida',
            text: 'Sesión no válida. Inicia sesión nuevamente.'
        }).then(() => {
            sessionStorage.clear();
            window.location.href = '/login.html';
        });
        return;
    }

    if (!idUsuarioCierre || isNaN(idUsuarioCierre)) {
        Swal.fire({
            icon: 'error',
            title: 'Usuario inválido',
            text: 'Usuario inválido para cerrar caja.'
        });
        return;
    }

    // Reemplazar confirm con SweetAlert
    Swal.fire({
        title: '¿Estás seguro?',
        text: '¿Estás seguro de cerrar la caja actual?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Sí, cerrar caja',
        cancelButtonText: 'Cancelar'
    }).then((result) => {
        if (result.isConfirmed) {
            // Proceder con el cierre de caja
            $.ajax({
                url: 'http://localhost:3000/api/caja/cerrar',
                type: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({
                    id_aperturas_cierres: parseInt(idSesion),
                    id_usuario_cierre: parseInt(idUsuarioCierre),
                    observaciones: 'Cierre manual desde interfaz con autenticación',
                    nombre_cajero: nombreCajero
                }),
                success: function (data) {
                    if (data.success) {
                        // 🔹 Limpiar estado de la caja
                        localStorage.removeItem('id_aperturas_cierres');
                        localStorage.removeItem('estado_caja');
                        localStorage.removeItem('numero_caja');
                        localStorage.removeItem('id_usuario_apertura');

                        // 🔹 Limpiar datos de la interfaz
                        $('#infoCajaUser').html('');
                        $('#tablaCaja tbody').html('<tr><td colspan="9" class="text-center text-muted">Caja cerrada. No hay movimientos.</td></tr>');
                        
                        // 🔹 Limpiar totales
                        $('#fondoInicial').text('$0');
                        $('#totalEfectivo').text('$0');
                        $('#totalTarjeta').text('$0');
                        $('#totalGeneral').text('$0');
                        $('#balanceActual').text('$0');
                        
                        // 🔹 LIMPIEZA DEL TOTAL RETIRADO
                        if ($('#totalRetirado').length > 0) {
                            $('#totalRetirado').parent().remove();
                        }

                        // 🔹 Desactivar botón de cerrar caja
                        $('#btnCerrarCaja').prop('disabled', true);

                        // 🔹 Habilitar abrir caja
                        $('#btnAbrirCaja').prop('disabled', false);

                        // 🔹 Limpiar sesión de autenticación de cierre
                        sessionStorage.removeItem('cierreAuth');

                        Swal.fire({
                            icon: 'success',
                            title: '¡Caja cerrada!',
                            text: 'Caja cerrada correctamente.',
                            timer: 2000,
                            showConfirmButton: false
                        });
                    } else {
                        Swal.fire({
                            icon: 'error',
                            title: 'Error',
                            text: data.error || 'Error desconocido al cerrar la caja.'
                        });
                    }
                },
                error: function (xhr, status, error) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error del servidor',
                        text: 'Error en el servidor: ' + error
                    });
                }
            });
        }
    });
  }

    $('#btnRetiroEfectivo').on('click', function() {
      // Verificar que hay una caja abierta
      const estadoCaja = localStorage.getItem('estado_caja');
      if (estadoCaja !== 'abierta') {
          Swal.fire({
              icon: 'warning',
              title: 'Caja no abierta',
              text: 'Debe tener una caja abierta para realizar retiros.'
          });
          return;
      }
      
      // Mostrar modal de autenticación primero
      $('#modalAuthAdmin').modal('show');
  });

  // Y en el evento de autenticación, guardar el username
  $('#formAuthAdmin').on('submit', function(e) {
      e.preventDefault();
      
      const username = $('#adminUsername').val();
      const password = $('#adminPassword').val();
      
      // Mostrar indicador de carga
      const submitBtn = $(this).find('button[type="submit"]');
      const originalText = submitBtn.text();
      submitBtn.prop('disabled', true).text('Verificando...');
      
      // Se llama sin tercer parámetro (usa 'retiro' por defecto)
      verificarAdmin(username, password)
          .then(resultado => {
              if (resultado.esAutorizado) {
                  // Guardar datos del usuario autorizado en sessionStorage
                  sessionStorage.setItem('adminAuth', JSON.stringify({
                      id: resultado.userData.id,
                      username: resultado.userData.username,
                      email: resultado.userData.email,
                      rol: resultado.rol,
                      timestamp: new Date().getTime()
                  }));
                  
                  $('#modalAuthAdmin').modal('hide');
                  
                  // Parsear balance correctamente
                  const balanceText = $('#balanceActual').text().replace('$', '');
                  const balanceActual = parseFloat(balanceText.replace(/\./g, '').replace(',', '.'));
                  
                  $('#balanceDisponible').text('$' + balanceActual.toLocaleString('es-CL'));
                  $('#modalRetiro').modal('show');
                  
                  // Limpiar formulario
                  $('#adminUsername').val('');
                  $('#adminPassword').val('');
                  
                  // Mostrar mensaje de éxito
                  Swal.fire({
                      icon: 'success',
                      title: 'Autenticación exitosa',
                      text: 'Usuario autorizado correctamente.',
                      timer: 1500,
                      showConfirmButton: false
                  });
              } else {
                  Swal.fire({
                      icon: 'error',
                      title: 'Acceso denegado',
                      text: resultado.mensaje || 'Credenciales incorrectas o usuario no tiene permisos para realizar retiros.'
                  });
              }
          })
          .catch(error => {
              console.error('Error en autenticación:', error);
              Swal.fire({
                  icon: 'error',
                  title: 'Error de autenticación',
                  text: 'Error al verificar credenciales: ' + error.message
              });
          })
          .finally(() => {
              // Restaurar botón
              submitBtn.prop('disabled', false).text(originalText);
          });
  });

  // Procesar retiro de efectivo
  $('#formRetiroEfectivo').on('submit', function(e) {
      e.preventDefault();
      
      // Obtener datos del admin desde sessionStorage
      const adminAuthRaw = sessionStorage.getItem('adminAuth');
      if (!adminAuthRaw) {
          Swal.fire({
              icon: 'warning',
              title: 'Sesión inválida',
              text: 'Sesión de administrador no válida. Por favor, autentíquese nuevamente.'
          }).then(() => {
              $('#modalAuthAdmin').modal('show');
          });
          return;
      }
      
      const adminAuth = JSON.parse(adminAuthRaw);
      const idUsuarioAdmin = adminAuth.id;
      
      // Parsear monto correctamente
      const monto = parseFloat($('#montoRetiro').val().replace(/\./g, '').replace(',', '.'));
      const motivo = $('#motivoRetiro').val() || 'Retiro de efectivo';
      
      // Parsear balance correctamente
      const balanceText = $('#balanceActual').text().replace('$', '');
      const balanceActual = parseFloat(balanceText.replace(/\./g, '').replace(',', '.'));
      
      // Validaciones
      if (isNaN(monto) || monto <= 0) {
          Swal.fire({
              icon: 'error',
              title: 'Monto inválido',
              text: 'Ingrese un monto válido mayor a cero.'
          });
          return;
      }
      
      if (monto > balanceActual) {
          Swal.fire({
              icon: 'error',
              title: 'Fondos insuficientes',
              text: `No puede retirar más del efectivo disponible. Disponible: $${balanceActual.toLocaleString('es-CL')}, Intenta retirar: $${monto.toLocaleString('es-CL')}`
          });
          return;
      }
      
      // Confirmación final con SweetAlert
      Swal.fire({
          title: '¿Confirmar retiro?',
          html: `¿Está seguro de retirar <strong>$${monto.toLocaleString('es-CL')}</strong>?`,
          icon: 'question',
          showCancelButton: true,
          confirmButtonColor: '#3085d6',
          cancelButtonColor: '#d33',
          confirmButtonText: 'Sí, retirar',
          cancelButtonText: 'Cancelar'
      }).then((result) => {
          if (result.isConfirmed) {
              // Mostrar loading
              const submitBtn = $(this).find('button[type="submit"]');
              const originalText = submitBtn.text();
              submitBtn.prop('disabled', true).text('Procesando...');
              
              // Realizar el retiro con el ID del admin
              realizarRetiro(monto, motivo, idUsuarioAdmin)
                  .then(() => {
                      Swal.fire({
                          icon: 'success',
                          title: '¡Retiro exitoso!',
                          text: 'Retiro realizado exitosamente.',
                          timer: 2000,
                          showConfirmButton: false
                      }).then(() => {
                          $('#modalRetiro').modal('hide');
                          $('#formRetiroEfectivo')[0].reset();
                          
                          // Limpiar sesión de admin después del retiro
                          sessionStorage.removeItem('adminAuth');
                          
                          cargarCaja(); // Recargar datos
                      });
                  })
                  .catch(error => {
                      console.error('Error en retiro:', error);
                      Swal.fire({
                          icon: 'error',
                          title: 'Error en retiro',
                          text: 'Error al procesar el retiro: ' + error.message
                      });
                  })
                  .finally(() => {
                      submitBtn.prop('disabled', false).text(originalText);
                  });
          }
      });
  });

  function verificarAdmin(username, password, tipoOperacion = 'retiro') {
    return new Promise((resolve, reject) => {
      const email = username;
      
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
          console.log("Respuesta completa del login:", response);
          
          if (response.message === "Login exitoso" && response.user && response.user.role) {
            const rolUsuario = response.user.role.toLowerCase();
            
            // Definir roles permitidos según el tipo de operación
            let rolesPermitidos = [];
            
            if (tipoOperacion === 'cierre') {
              // Para cierre de caja: admin, supervisor, recaudador, tesorero
              rolesPermitidos = ['admin', 'supervisor', 'recaudador', 'tesorero'];
            } else if (tipoOperacion === 'retiro') {
              // Para retiro de efectivo: admin, recaudador, tesorero (excluye supervisor)
              rolesPermitidos = ['admin', 'recaudador', 'tesorero'];
            }
            
            const tienePermiso = rolesPermitidos.includes(rolUsuario);
            
            if (tienePermiso) {
              resolve({
                esAutorizado: true,
                userData: response.user,
                rol: rolUsuario
              });
            } else {
              let mensaje = '';
              if (tipoOperacion === 'cierre') {
                mensaje = 'Su rol no tiene permisos para cerrar caja.';
              } else {
                mensaje = 'Su rol no tiene permisos para realizar retiros.';
              }
              
              resolve({ 
                esAutorizado: false,
                mensaje: mensaje
              });
            }
          } else {
            resolve({ 
              esAutorizado: false,
              mensaje: 'Credenciales incorrectas'
            });
          }
        },
        error: function(xhr, status, error) {
          console.error('Error en verificación:', error, "Status:", xhr.status);
          if (xhr.status === 401) {
            resolve({ 
              esAutorizado: false,
              mensaje: 'Credenciales incorrectas'
            });
          } else {
            reject(new Error('Error de conexión: ' + error));
          }
        }
      });
    });
  }

  // Función para realizar el retiro
  function realizarRetiro(monto, motivo, idUsuarioAdmin) {
      return new Promise(async (resolve, reject) => {
          const token = sessionStorage.getItem('authToken');
          
          // Obtener el nombre del cajero desde sessionStorage
          const usuarioRaw = sessionStorage.getItem('usuario');
          const usuario = usuarioRaw ? JSON.parse(usuarioRaw) : null;
          const nombre_cajero = usuario ? usuario.username : 'Cajero';
          
          try {
              // 1. Registrar el retiro
              const response = await $.ajax({
                  url: 'http://localhost:3000/api/caja/retiros',
                  type: 'POST',
                  headers: {
                      'Authorization': 'Bearer ' + token,
                      'Content-Type': 'application/json'
                  },
                  data: JSON.stringify({
                      monto: monto,
                      motivo: motivo,
                      id_usuario: idUsuarioAdmin,
                      nombre_cajero: nombre_cajero
                  })
              });

              if (!response.success) {
                  throw new Error(response.message || 'Error en el retiro');
              }

              // 2. Imprimir primera copia
              await imprimirCopiaRetiro(response.datosImpresion);

              // 3. Mostrar alerta para cortar el primer comprobante
              await mostrarAlertaCorte();

              // 4. Imprimir segunda copia
              await imprimirCopiaRetiro(response.datosImpresion);

              resolve(response);

          } catch (error) {
              reject(new Error('Error del servidor: ' + error));
          }
      });
  }

  // Función para imprimir una copia del retiro
  async function imprimirCopiaRetiro(datosImpresion) {
      try {
          const token = sessionStorage.getItem('authToken');
          const response = await $.ajax({
              url: 'http://localhost:3000/api/caja/imprimir-retiro',
              type: 'POST',
              headers: {
                  'Authorization': 'Bearer ' + token,
                  'Content-Type': 'application/json'
              },
              data: JSON.stringify(datosImpresion)
          });

          if (!response.success) {
              throw new Error(response.message || 'Error al imprimir');
          }

          return response;
      } catch (error) {
          console.error('Error al imprimir comprobante:', error);
          throw error;
      }
  }

  // Función para mostrar el alerta de corte
  function mostrarAlertaCorte() {
      return new Promise((resolve) => {
          Swal.fire({
              title: 'Corte el primer comprobante',
              text: 'Por favor, corte el primer comprobante antes de continuar',
              icon: 'info',
              showCancelButton: false,
              confirmButtonText: 'Continuar',
              allowOutsideClick: false,
              allowEscapeKey: false,
          }).then((result) => {
              if (result.isConfirmed) {
                  resolve();
              }
          });
      });
  }

  // Mostrar información del autorizador cuando se abre el modal
  $('#modalRetiro').on('show.bs.modal', function() {
    const adminAuthRaw = sessionStorage.getItem('adminAuth');
    
    if (adminAuthRaw) {
      const adminAuth = JSON.parse(adminAuthRaw);
      $('#nombreAutorizador').text(adminAuth.username); // Mostrar el nombre de usuario
      $('#infoAutorizador').removeClass('d-none');
    } else {
      $('#infoAutorizador').addClass('d-none');
    }
  });

  // Limpiar la información cuando se cierra el modal
  $('#modalRetiro').on('hidden.bs.modal', function() {
    $('#infoAutorizador').addClass('d-none');
    $('#nombreAutorizador').text('');
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