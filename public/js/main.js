document.addEventListener('DOMContentLoaded', () => {
  const token = sessionStorage.getItem('authToken');
  const usuarioJSON = sessionStorage.getItem('usuario');

  if (!token || !usuarioJSON) {
    alert('Debes iniciar sesión primero.');
    window.location.href = '/login.html';
    return;
  }

  let usuario;
  try {
    usuario = JSON.parse(usuarioJSON);
  } catch (e) {
    console.error('Error al parsear usuario:', e);
    sessionStorage.clear();
    window.location.href = '/login.html';
    return;
  }

  // Validación extra por si el objeto está mal formado
  if (!usuario.username || !usuario.email || !usuario.role) {
    alert('Datos de usuario inválidos. Inicia sesión nuevamente.');
    sessionStorage.clear();
    window.location.href = '/login.html';
    return;
  }
});

document.addEventListener("DOMContentLoaded", function () {
  const modal = document.getElementById("ticket-overlay");
  const inputField = document.getElementById("ticketInput");
  const closeBtn = document.querySelector(".close-button");
  const reimprimirBtn2 = document.getElementById("reimprimirBtn2");
  const searchBtn = document.getElementById("searchTicketBtn");
  // const url = urlBase + "/TerminalCalama/PHP/Restroom/load.php";

  const tipoEl = modal.querySelector(".info-item:nth-child(1) .info-value");
  const codigoEl = modal.querySelector(".info-item:nth-child(2) .info-value");
  const fechaEl = modal.querySelector(".info-item:nth-child(3) .info-value");
  const horaEl = modal.querySelector(".info-item:nth-child(4) .info-value");
  const estadoEl = modal.querySelector(".info-item:nth-child(5) .info-value");

  searchBtn.addEventListener("click", async function () {
    const codigo = inputField.value.trim();

    if (!/^\d{10}$/.test(codigo)) {
      Swal.fire({
        icon: "warning",
        title: "Código inválido",
        text: "El código debe contener exactamente 10 números.",
        customClass: {
          title: "swal-font",
          htmlContainer: "swal-font",
          popup: "alert-card",
          confirmButton: "my-confirm-btn",
        },
        buttonsStyling: false,
      });
      return;
    }

    if (!codigo) return;

    showSpinner();

    const userPin = codigo.slice(0, 6);

    const url = `${urlBase}/TerminalCalama/PHP/Restroom/getCodigo.php?codigo=${codigo}`;
    const urlEstado = `${urlBase}/TerminalCalama/PHP/Restroom/estadoBoleto.php?userPin=${userPin}`;

    try {
      const res = await fetch(url);
      const data = await res.json();
      const ticket = data.find((t) => t.Codigo === codigo);
      console.log(ticket);

      const resEstado = await fetch(urlEstado);
      const dataEstado = await resEstado.json();
      let estadoTicket = dataEstado.message || "No encontrado";
      estadoTicket = estadoTicket.toUpperCase().replace(/\.$/, "");

      estadoEl.textContent = estadoTicket;
      estadoEl.style.fontWeight = "bold";

      if (estadoTicket === "BOLETO SIN USAR") {
        estadoEl.style.color = "green";
      } else {
        estadoEl.style.color = "red";
      }

      if (ticket) {
        tipoEl.textContent = ticket.tipo;
        codigoEl.textContent = ticket.Codigo;
        fechaEl.textContent = ticket.date;
        horaEl.textContent = ticket.time;

        const numeroT = ticket.Codigo;

        const contenedorTicketQR2 = document.getElementById(
          "contenedorTicketQR2"
        );
        contenedorTicketQR2.innerHTML = "";

        const qr = new QRCode(contenedorTicketQR2, {
          text: numeroT,
        });

        modal.style.display = "flex";
      } else {
        Swal.fire({
          icon: "error",
          title: "No encontrado",
          text: "No se encontró ningún ticket con ese código.",
          customClass: {
            title: "swal-font",
            htmlContainer: "swal-font",
            popup: "alert-card",
            confirmButton: "my-confirm-btn",
          },
          buttonsStyling: false,
        });
        modal.style.display = "none";
      }
    } catch (err) {
      console.error("Error al buscar ticket:", err);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Ocurrió un error al buscar el ticket. Intenta nuevamente.",
        customClass: {
          title: "swal-font",
          htmlContainer: "swal-font",
          popup: "alert-card",
          confirmButton: "my-confirm-btn",
        },
        buttonsStyling: false,
      });
    } finally {
      hideSpinner();
    }
  });

  closeBtn.addEventListener("click", function () {
    modal.style.display = "none";
    inputField.value = "";
  });

  window.addEventListener("click", function (event) {
    if (event.target === modal) {
      modal.style.display = "none";
      inputField.value = "";
    }
  });

  reimprimirBtn2.addEventListener("click", async function () {
    const codigo = document.querySelector(".info-item:nth-child(2) .info-value").textContent.trim();
    const tipo = document.querySelector(".info-item:nth-child(1) .info-value").textContent.trim();
    const fecha = document.querySelector(".info-item:nth-child(3) .info-value").textContent.trim();
    const hora = document.querySelector(".info-item:nth-child(4) .info-value").textContent.trim();
    const estado = document.querySelector(".info-item:nth-child(5) .info-value").textContent.trim().toUpperCase();

    if (estado !== "BOLETO SIN USAR") {
      Swal.fire({
        icon: "warning",
        title: "Reimpresión no permitida",
        text: "No se puede reimprimir un boleto que ya ha sido ocupado.",
        customClass: {
          title: "swal-font",
          htmlContainer: "swal-font",
          popup: "alert-card",
          confirmButton: "my-confirm-btn",
        },
        buttonsStyling: false,
      });
      return;
    }

    showSpinner();

    try {
      const contenedorQR = document.getElementById("contenedorTicketQR2");
      const qrCanvas = contenedorQR.querySelector("canvas");
      let qrBase64 = "";
      if (qrCanvas) {
        qrBase64 = qrCanvas.toDataURL("image/png").replace(/^data:image\/png;base64,/, "");
      }

      const payload = {
        Codigo: codigo,
        fecha,
        hora,
        tipo,
        qrBase64
      };

      const res = await fetch("http://localhost:3000/api/print", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await res.json();
        if (!data.success) {
          throw new Error(data.error || "Error inesperado");
        }
      } else {
        const text = await res.text();
        throw new Error(`Respuesta no JSON: ${text}`);
      }

      Swal.fire({
        icon: "success",
        title: "Reimpresión enviada",
        text: `El ticket ${codigo} ha sido enviado a impresión.`,
        customClass: {
          title: "swal-font",
          htmlContainer: "swal-font",
          popup: "alert-card",
          confirmButton: "my-confirm-btn",
        },
        buttonsStyling: false,
      });

    } catch (err) {
      console.error("Error al imprimir:", err);
      Swal.fire({
        icon: "error",
        title: "Error al imprimir",
        text: err.message || "No se pudo imprimir el ticket.",
        customClass: {
          title: "swal-font",
          htmlContainer: "swal-font",
          popup: "alert-card",
          confirmButton: "my-confirm-btn",
        },
        buttonsStyling: false,
      });
    } finally {
      hideSpinner();
    }
  });

  function openResumen() {
    const modal = document.getElementById("resumen-overlay");
    // const spinner = document.getElementById("spinner");

    showSpinner();
    cargarTabla().then(() => {
      hideSpinner();
      modal.style.display = "flex";
    });
  }

  function cargarTabla() {
    const endpointURL = urlBase + "/TerminalCalama/PHP/Restroom/load.php";
    const tableBody = document.getElementById("sales-table-body");

    tableBody.innerHTML = "";

    return fetch(endpointURL)
      .then((response) => response.json())
      .then((data) => {
        const ordenado = data.sort((a, b) => {
          const fechaA = new Date(`${a.date} ${a.time}`);
          const fechaB = new Date(`${b.date} ${b.time}`);
          return fechaB - fechaA;
        });

        const ultimos = ordenado.slice(0, 8);

        ultimos.forEach((item) => {
          const row = document.createElement("tr");

          const tipoCell = document.createElement("td");
          tipoCell.textContent = item.tipo;
          row.appendChild(tipoCell);

          const codigoCell = document.createElement("td");
          codigoCell.textContent = item.Codigo;
          row.appendChild(codigoCell);

          const fechaCell = document.createElement("td");
          fechaCell.textContent = item.date;
          row.appendChild(fechaCell);

          const horaCell = document.createElement("td");
          horaCell.textContent = item.time;
          row.appendChild(horaCell);

          const printCell = document.createElement("td");
          printCell.style.textAlign = "center";

          const printButton = document.createElement("button");
          printButton.className = "print-button";
          printButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="35" height="35" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 6 2 18 2 18 9"></polyline>
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
              <rect x="6" y="14" width="12" height="8"></rect>
            </svg>
          `;
          printButton.addEventListener("click", async function () {
            const overlay = document.getElementById("ticket-print-overlay");
            const modal = document.getElementById("ticket-print-modal");
            const modalResume = document.getElementById("resumen-overlay");
            modalResume.style.display = "none";
            overlay.style.display = "none";

            showSpinner();

            const userPin = item.Codigo.slice(0, 6);

            const urlEstado = `${urlBase}/TerminalCalama/PHP/Restroom/estadoBoleto.php?userPin=${userPin}`;

            const resEstado = await fetch(urlEstado);
            if (!resEstado.ok) {
              throw new Error("Error al obtener estado del boleto.");
            }
            const dataEstado = await resEstado.json();
            let estadoTicket = dataEstado.message || "No encontrado";
            estadoTicket = estadoTicket.toUpperCase().replace(/\.$/, "");

            const infoItems = modal.querySelectorAll(".info-item");
            infoItems.forEach((infoItem) => {
              const label = infoItem
                .querySelector(".info-label")
                .textContent.trim();
              const value = infoItem.querySelector(".info-value");

              if (label === "ESTADO") {
                value.textContent = estadoTicket;
                value.style.fontWeight = "bold";
                if (estadoTicket === "EL BOLETO HA SIDO OCUPADO") {
                  value.style.color = "red";
                } else {
                  value.style.color = "green";
                }
              }

              if (label === "TIPO") value.textContent = item.tipo;
              if (label === "CÓDIGO") value.textContent = item.Codigo;
              if (label === "FECHA") value.textContent = item.date;
              if (label === "HORA") value.textContent = item.time;
            });

            const numeroT = item.Codigo;
            const contenedorTicketQR1 = document.getElementById(
              "contenedorTicketQR1"
            );
            contenedorTicketQR1.innerHTML = "";
            new QRCode(contenedorTicketQR1, {
              text: numeroT,
            });

            hideSpinner();
            overlay.style.display = "flex";

            reimprimirBtn1.addEventListener("click", async function () {
              if (estadoTicket !== "BOLETO SIN USAR") {
                Swal.fire({
                  icon: "warning",
                  title: "No permitido",
                  text: "Solo se pueden reimprimir boletos sin usar.",
                  customClass: {
                    title: "swal-font",
                    htmlContainer: "swal-font",
                    popup: "alert-card",
                    confirmButton: "my-confirm-btn",
                  },
                  buttonsStyling: false,
                });
                return;
              }

            showSpinner();

            try {
              const qrCanvas = contenedorTicketQR1.querySelector("canvas");
              let qrBase64 = "";
              if (qrCanvas) {
                qrBase64 = qrCanvas.toDataURL("image/png").replace(/^data:image\/png;base64,/, "");
              }

              const payload = {
                Codigo: item.Codigo,
                fecha: item.date,
                hora: item.time,
                tipo: item.tipo,
                qrBase64
              };

              const res = await fetch('http://localhost:3000/api/print', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
              });

              const contentType = res.headers.get('content-type');
              if (contentType && contentType.includes('application/json')) {
                const data = await res.json();
                if (!data.success) {
                  throw new Error(data.error || 'Error inesperado');
                }
              } else {
                const text = await res.text();
                throw new Error(`Respuesta no JSON: ${text}`);
              }

              Swal.fire({
                icon: "success",
                title: "Reimpresión enviada",
                text: `El ticket ${item.Codigo} ha sido enviado a impresión.`,
                customClass: {
                  title: "swal-font",
                  htmlContainer: "swal-font",
                  popup: "alert-card",
                  confirmButton: "my-confirm-btn",
                },
                buttonsStyling: false,
              });

            } catch (err) {
              console.error("Error al imprimir:", err);
              Swal.fire({
                icon: "error",
                title: "Error al imprimir",
                text: err.message || "No se pudo imprimir el ticket.",
                customClass: {
                  title: "swal-font",
                  htmlContainer: "swal-font",
                  popup: "alert-card",
                  confirmButton: "my-confirm-btn",
                },
                buttonsStyling: false,
              });
            } finally {
              hideSpinner();
            }
           });
          });

          printCell.appendChild(printButton);
          row.appendChild(printCell);
          tableBody.appendChild(row);
        });
      })
      .catch((error) => {
        console.error("Error al obtener datos:", error);
      });
  }

  document
    .getElementById("resumen-overlay")
    .addEventListener("click", function (e) {
      if (e.target.id === "resumen-overlay") {
        closeResumen();
      }
    });

  document
    .getElementById("resumen-button")
    .addEventListener("click", openResumen);

  document
    .getElementById("ticket-print-overlay")
    .addEventListener("click", function (e) {
      if (e.target.id === "ticket-print-overlay") {
        closeTicketModal();
      }
    });
});

function closeResumen() {
  const modal = document.getElementById("resumen-overlay");
  modal.style.display = "none";
}

function closeTicketModal() {
  document.getElementById("ticket-print-overlay").style.display = "none";
}
// animacion codigo qr
let rotation = 0;

function rotateQR() {
  rotation += 90;
  document.querySelector(".img-qr").style.transform = `rotate(${rotation}deg)`;
}

document.querySelector(".btn-genera-baño").addEventListener("click", rotateQR);
document.querySelector(".btn-genera-ducha").addEventListener("click", rotateQR);

// spinner
function showSpinner() {
  const spinner = document.getElementById("spinner");
  if (spinner) {
    spinner.style.display = "flex";
  }
}

function hideSpinner() {
  const spinner = document.getElementById("spinner");
  if (spinner) {
    spinner.style.display = "none";
  }
}
