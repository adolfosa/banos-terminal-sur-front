const contenedorQR = document.getElementById("contenedorQR");
const parrafoCodigo = document.getElementById("codigo");
const parrafoFecha = document.getElementById("fecha");
const parrafoHora = document.getElementById("hora");
const parrafoTipo = document.getElementById("tipo");
const botonesQR = document.querySelectorAll(".generarQR");

const QR = new QRCode(contenedorQR);
QR.makeCode("wit");

const urlBase = "https://andenes.terminal-calama.com";
const url = urlBase + "/TerminalCalama/PHP/Restroom/save.php";

// console.log(urlBase);

// leerDatosServer();
let datosPendientes = null;

let botonActivo = null;

let serviciosDisponibles = {};

// Fallbacks si la API no responde o no trae el tipo
const PRECIO_FALLBACK = { BAÑO: 500, DUCHA: 3500 };
const getPrecio = (tipo) => {
  const api = Number(serviciosDisponibles?.[tipo]?.precio);
  return Number.isFinite(api) && api > 0 ? api : PRECIO_FALLBACK[tipo] ?? 0;
};

async function cargarServicios() {
  try {
    const token = sessionStorage.getItem("authToken");
    if (!token) throw new Error("No se encontró token de autenticación");

    const res = await fetch("https://backend-banios.dev-wit.com/api/services", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) throw new Error(`Error HTTP: ${res.status}`);

    const data = await res.json();

    // Ahora la API devuelve los servicios en data.data
    if (!Array.isArray(data.data))
      throw new Error("Formato inesperado en respuesta de servicios");

    serviciosDisponibles = {};

    // Filtrar solo servicios con estado activo
    const serviciosActivos = data.data.filter((s) => s.estado === "activo");

    serviciosActivos.forEach((s) => {
      serviciosDisponibles[s.tipo] = {
        id: s.id,
        nombre: s.nombre,
        precio: parseFloat(s.precio),
        estado: s.estado,
      };
    });

    const contenedor = document.getElementById("btns-container");
    contenedor.innerHTML = "";

    Object.entries(serviciosDisponibles).forEach(([tipo, info]) => {
      const claseTipo = `btn-genera-${tipo.toLowerCase()}`;

      const btn = document.createElement("button");
      btn.className = `${claseTipo} lg-button generarQR`;
      btn.setAttribute("data-tipo", tipo);
      btn.innerHTML = `
        ${info.nombre} <br />
        <span class="precio">$${info.precio.toLocaleString("es-CL")}</span>
      `;
      contenedor.appendChild(btn);
    });

    document.querySelectorAll(".generarQR").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();

        const estado_caja = localStorage.getItem("estado_caja");
        const id_aperturas_cierres = localStorage.getItem(
          "id_aperturas_cierres"
        );

        if (estado_caja !== "abierta") {
          Swal.fire({
            icon: "warning",
            title: "Caja cerrada",
            text: "Por favor, primero debe abrir la caja antes de generar un QR.",
            confirmButtonText: "Entendido",
          });
          return;
        }

        const fechaHoraAct = new Date();
        const horaStr = `${fechaHoraAct
          .getHours()
          .toString()
          .padStart(2, "0")}:${fechaHoraAct
          .getMinutes()
          .toString()
          .padStart(2, "0")}:${fechaHoraAct
          .getSeconds()
          .toString()
          .padStart(2, "0")}`;
        const fechaStr = fechaHoraAct.toISOString().split("T")[0];
        const tipoStr = btn.dataset.tipo;
        const numeroT = generarTokenNumerico();
        const valor = getPrecio(tipoStr);

        datosPendientes = {
          Codigo: numeroT,
          hora: horaStr,
          fecha: fechaStr,
          tipo: tipoStr,
          valor: valor,
          id_caja: id_aperturas_cierres,
          estado_caja,
        };

        botonActivo = btn;
        btn.disabled = true;
        btn.classList.add("disabled");

        document.getElementById("modalPago").style.display = "flex";
      });
    });

    console.log("Servicios activos cargados:", serviciosDisponibles);
  } catch (err) {
    console.error("Error al cargar servicios:", err);
    alert("Error al cargar servicios disponibles: " + err.message);
  }
}

// Llamar al cargar la página
cargarServicios();

function cerrarModalPago() {
  document.getElementById("modalPago").style.display = "none";
  if (botonActivo) {
    botonActivo.disabled = false;
    botonActivo.classList.remove("disabled");
    botonActivo = null;
  }
  datosPendientes = null;
}

const originalFetch = window.fetch;

window.fetch = async (url, options = {}) => {
  console.log("🔗 Mock fetch interceptado:", url, options);

  // MOCK externo: Restroom (save, addUser, addLevelUser2)
  if (
    url.includes(
      "https://andenes.terminal-calama.com/TerminalCalama/PHP/Restroom/save.php"
    ) ||
    url.includes(
      "https://andenes.terminal-calama.com/TerminalCalama/PHP/Restroom/addUser.php"
    ) ||
    url.includes(
      "https://andenes.terminal-calama.com/TerminalCalama/PHP/Restroom/addLevelUser2.php"
    )
  ) {
    console.log("✅ MOCK Restroom devuelto");
    return {
      ok: true,
      status: 200,
      json: async () => ({ success: true, msg: "Mock exitoso" }),
      text: async () => "Mock exitoso",
    };
  }

  // MOCK localhost: /api/payment
  if (url.includes("/api/payment")) {
    return {
      ok: true,
      status: 200,
      headers: { get: (h) => "application/json" },
      json: async () => ({
        data: {
          successful: true,
          responseCode: 0,
          responseMessage: "Transacción aprobada (mock)",
        },
      }),
    };
  }

  // MOCK localhost: /api/caja/movimientos
  if (url.includes("/api/caja/movimientos")) {
    return {
      ok: true,
      headers: { get: (h) => "application/json" },
      json: async () => ({
        success: true,
        id: Date.now(),
        msg: "Movimiento guardado (mock)",
      }),
    };
  }

  // Dejar /api/print real
  if (url.includes("/api/print")) {
    return originalFetch(url, options);
  }

  // Fallback: fetch real
  return originalFetch(url, options);
};

async function continuarConPago(metodoPago) {
  if (!datosPendientes) return;

  const { Codigo, hora, fecha, tipo } = datosPendientes;
  const estado_caja = localStorage.getItem("estado_caja");
  const precioFinal = getPrecio(tipo);
  const datos = { Codigo, hora, fecha, tipo, valor: precioFinal };

  // Validación y pago con tarjeta
  if (metodoPago === "TARJETA") {
    // Usa el precio traído desde /api/servicios
    const monto = Math.round(Number(precioFinal) || 0);

    try {
      showSpinner();

      const res = await fetch("http://localhost:3000/api/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: monto,
          ticketNumber: Codigo,
        }),
      });

      const contentType = res.headers.get("content-type");
      const result = contentType?.includes("application/json")
        ? await res.json()
        : null;

      if (
        !result ||
        !result.data?.successful ||
        result.data.responseCode !== 0
      ) {
        const msg =
          result?.data?.responseMessage || "Pago no aprobado por el POS";
        throw new Error(`Transacción fallida: ${msg}`);
      }

      console.log("✅ Transacción aprobada:", result);
    } catch (err) {
      console.error("❌ Error durante el pago:", err);
      Swal.fire({
        icon: "error",
        title: "Pago fallido",
        text: err.message || "No se pudo completar el pago con tarjeta.",
        customClass: {
          title: "swal-font",
          htmlContainer: "swal-font",
          popup: "alert-card",
          confirmButton: "my-confirm-btn",
        },
        buttonsStyling: false,
      });
      hideSpinner();
      cerrarModalPago();
      return;
    }
  }

  // Mostrar datos en interfaz
  parrafoFecha.textContent = fecha;
  parrafoHora.textContent = hora;
  parrafoTipo.textContent = `${tipo} (${metodoPago})`;
  parrafoCodigo.textContent = Codigo;

  showSpinner();

  // Obtener ID del usuario desde el token
  const token = sessionStorage.getItem("authToken");
  const jwtPayload = parseJwt(token);

  if (!jwtPayload?.id) {
    alert("Sesión expirada. Inicia sesión nuevamente.");
    window.location.href = "/login.html";
    return;
  }

  const id_usuario = jwtPayload.id;

  await callApi(datos);
  // Registrar movimiento en la base de datos
  await fetch("http://localhost:3000/api/caja/movimientos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      codigo: Codigo,
      fecha,
      hora,
      tipo,
      valor: precioFinal,
      metodoPago,
      estado_caja,
      id_usuario,
    }),
  });

  // Generar y enviar voucher con QR
  QR.makeCode(Codigo);
  await new Promise((resolve) => setTimeout(resolve, 500));

  const qrCanvas = contenedorQR.querySelector("canvas");
  const qrBase64 = qrCanvas
    ? qrCanvas.toDataURL("image/png").replace(/^data:image\/png;base64,/, "")
    : "";

  const printPayload = {
    Codigo,
    hora,
    fecha,
    tipo,
    valor: precioFinal,
    qrBase64,
  };

  const estado = document.createElement("p");
  contenedorQR.appendChild(estado);

  try {
    const res = await fetch("http://localhost:3000/api/print", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(printPayload),
    });

    const contentType = res.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Error inesperado");
    } else {
      const text = await res.text();
      throw new Error(`Respuesta no JSON: ${text}`);
    }
  } catch (err) {
    estado.textContent = `❌ Error al imprimir: ${err.message}`;
  } finally {
    hideSpinner();
    if (botonActivo) {
      botonActivo.disabled = false;
      botonActivo.classList.remove("disabled");
      botonActivo = null;
    }
  }

  // Registro interno adicional
  addUser(Codigo);
  setTimeout(() => addUserAccessLevel(Codigo.substring(0, 6)), 1000);

  document.getElementById("modalPago").style.display = "none";
  datosPendientes = null;

  // Función local para decodificar el JWT
  function parseJwt(token) {
    try {
      const base64Url = token.split(".")[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join("")
      );
      return JSON.parse(jsonPayload);
    } catch (err) {
      console.error("Token inválido:", err);
      return null;
    }
  }
}

function generarTokenNumerico() {
  let token = (Math.floor(Math.random() * 9) + 1).toString();
  for (let i = 1; i < 10; i++) {
    token += Math.floor(Math.random() * 10);
  }
  return token;
}

function escribirTexto() {
  contenedorContador.innerHTML = "texto";
}

async function callApi(datos) {
  let ret = await fetch(url, {
    method: "POST",
    mode: "cors",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(datos),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error("Error en la solicitud");
      }
      return response.text();
    })
    .then((result) => {
      console.log("Respuesta del servidor:", result);
    })
    .catch((error) => {
      console.error("Error al enviar la solicitud:", error);
    });
  return ret;
}

function printQR() {
  const ventanaImpr = window.open("", "_blank");

  // Obtenemos la fecha y hora actual
  const dateAct = new Date();
  const horaStr =
    dateAct.getHours().toString().padStart(2, "0") +
    ":" +
    dateAct.getMinutes().toString().padStart(2, "0") +
    ":" +
    dateAct.getSeconds().toString().padStart(2, "0");
  const fechaStr = dateAct.toISOString().split("T")[0];

  // Obtener el código QR generado
  const codigoQR = document.getElementById("keycont").value;
  const tipoSeleccionado = document.querySelector(
    'input[name="tipo"]:checked'
  ).value;

  if (!codigoQR) {
    alert("No hay código QR generado para imprimir.");
    return;
  }

  const precio =
    (serviciosDisponibles?.[tipoSeleccionado]?.precio ??
      datosPendientes?.valor ??
      null) != null
      ? `$${Number(
          serviciosDisponibles?.[tipoSeleccionado]?.precio ??
            datosPendientes?.valor
        ).toLocaleString("es-CL")}`
      : "No definido";

  ventanaImpr.document.write(`
        <html>
            <head>
                <title>Imprimir QR</title>
                <style>
                    body { text-align: center; font-family: Arial, sans-serif; }
                    h1, h3 { margin: 5px; }
                    .qr-container { display: flex; justify-content: center; margin-top: 10px; }
                    .close-btn {
                        background-color: red;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        font-size: 16px;
                        cursor: pointer;
                        margin-top: 20px;
                        border-radius: 5px;
                    }
                    .close-btn:hover {
                        background-color: darkred;
                    }
                    @media print {
                        .close-btn {
                            display: none;
                        }
                    }
                </style>
            </head>
            <body onload="window.print(); setTimeout(() => window.close(), 500);">
                <h1>Ticket de Acceso</h1>
                <h3>Fecha: ${fechaStr}</h3>
                <h3>Hora: ${horaStr}</h3>
                <h3>Tipo: ${tipoSeleccionado}</h3>
                <h3>Precio: ${precio}</h3>
                <h3>Código: ${codigoQR}</h3>
                <div class="qr-container">
                    ${document.getElementById("contenedorQR").innerHTML}
                </div>
                <button type="button" class="close-btn" onclick="window.close();">Cerrar</button>
            </body>
        </html>
    `);
  ventanaImpr.document.close();
}

async function addUser(token) {
  const url = urlBase + "/TerminalCalama/PHP/Restroom/addUser.php";

  const userData = { pin: token, idNo: token };

  try {
    let response = await fetch(url, {
      method: "POST",
      mode: "cors",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(userData),
    });

    let result = await response.text(); // Esperar a que la respuesta se convierta en texto
    console.log("Respuesta de addUser:", result);
  } catch (error) {
    console.error("Error al agregar usuario:", error);
  }
}

// Función para asignar niveles de acceso al usuario
async function addUserAccessLevel(token) {
  const url = urlBase + "/TerminalCalama/PHP/Restroom/addLevelUser2.php";
  const accessData = { pin: token };

  try {
    let response = await fetch(url, {
      method: "POST",
      mode: "cors",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(accessData),
    });

    let result = await response.text();
    console.log("Respuesta de addLevelUser2:", result);
  } catch (error) {
    console.error("Error al asignar niveles de acceso:", error);
  }
}

// Eventos para botones de pago
document.getElementById("btnPagoEfectivo").addEventListener("click", () => {
  continuarConPago("EFECTIVO");
});

document.getElementById("btnPagoTarjeta").addEventListener("click", () => {
  continuarConPago("TARJETA");
});
