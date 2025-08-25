$(document).ready(() => {
  const usuarioRaw = sessionStorage.getItem('usuario');
  const usuario = usuarioRaw ? JSON.parse(usuarioRaw) : null;
  const nombre = usuario?.username || 'desconocido';

  // Cargar cajas NO arqueadas
  $('#btnArqueoCajas').on('click', () => {
    fetch('http://localhost:3000/api/caja/cajas-dia')
      .then(res => res.json())
      .then(data => {
        const contenedor = $('#tablaArqueo tbody');

        if (!data.success || !Array.isArray(data.detalles) || data.detalles.length === 0) {
          contenedor.html('<tr><td colspan="9" class="text-center text-muted">No hay cajas pendientes de arqueo.</td></tr>');
          $('#btnConfirmarArqueo').addClass('d-none').hide();
          return;
        }

        const filas = data.detalles.map(c => `
          <tr>
            <td>${c.id}</td>
            <td>${c.nombre_caja}</td>
            <td>${c.username}</td>
            <td>${c.fecha_apertura}</td>
            <td>${c.hora_apertura}</td>
            <td>$${parseFloat(c.monto_inicial).toLocaleString()}</td>
            <td>$${parseFloat(c.total_efectivo).toLocaleString()}</td>
            <td>$${parseFloat(c.total_tarjeta).toLocaleString()}</td>
            <td>${c.observaciones ?? '—'}</td>
          </tr>
        `).join('');

        contenedor.html(filas);
        $('#btnConfirmarArqueo').removeClass('d-none').show();
      })
      .catch(err => {
        console.error(err);
        alert('Error al cargar datos para arqueo.');
      });
  });

  // Confirmar arqueo (actualiza observaciones y fue_arqueada = true)
  $('#btnConfirmarArqueo').on('click', () => {
    fetch('http://localhost:3000/api/caja/arqueo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre })
    })
      .then(res => res.json())
      .then(data => {
        const contenedor = $('#tablaArqueo tbody');

        if (data.success) {
          alert(data.mensaje);

          const filas = data.detalles.map(c => `
            <tr>
              <td>${c.id}</td>
              <td>${c.nombre_caja}</td>
              <td>${c.username}</td>
              <td>${c.fecha_apertura}</td>
              <td>${c.hora_apertura}</td>
              <td>$${parseFloat(c.monto_inicial).toLocaleString()}</td>
              <td>$${parseFloat(c.total_efectivo).toLocaleString()}</td>
              <td>$${parseFloat(c.total_tarjeta).toLocaleString()}</td>
              <td>${c.observaciones}</td>
            </tr>
          `).join('');

          contenedor.html(filas);
          $('#btnConfirmarArqueo').addClass('d-none').hide();
        } else {
          alert('Error: ' + (data.error || 'No se pudo completar el arqueo.'));
        }
      })
      .catch(err => {
        console.error(err);
        alert('Error en el servidor al realizar arqueo.');
      });
  });

  $('#btnVolver').on('click', () => {
    window.location.href = '/home.html';
  });
});
