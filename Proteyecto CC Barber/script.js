// --------------------------
// IMPORTS FIREBASE (v10+)
// --------------------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --------------------------
// CONFIG FIREBASE
// --------------------------
const firebaseConfig = {
  apiKey: "AIzaSyAhaOL0uMMt83I4OeM4Il1rDTwsp7aXgIg",
  authDomain: "ccbarber-148f5.firebaseapp.com",
  projectId: "ccbarber-148f5",
  storageBucket: "ccbarber-148f5.firebasestorage.app",
  messagingSenderId: "226429107709",
  appId: "1:226429107709:web:1e1b62fb7d0b43a55d2d94"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --------------------------
// VARIABLES
// --------------------------
const form = document.getElementById("citaForm");
const fechaInput = document.getElementById("fecha");
const horasContainer = document.getElementById("horas");
const estado = document.getElementById("estado");

let servicioSeleccionado = null;
let horaSeleccionada = null;

// HORARIO
const HORA_INICIO = 14;
const HORA_FIN = 22;
const BLOQUE = 30;

// Fecha mínima hoy
fechaInput.min = new Date().toISOString().split("T")[0];

// --------------------------
// SERVICIOS (CARDS)
// --------------------------
const cards = document.querySelectorAll(".servicio-card");
cards.forEach(card => {
  card.addEventListener("click", () => {
    cards.forEach(c => c.classList.remove("activo"));
    card.classList.add("activo");

    servicioSeleccionado = {
      nombre: card.querySelector("h3").textContent,
      duracion: Number(card.dataset.duracion),
      precio: Number(card.dataset.precio)
    };

    generarHoras();
  });
});

// --------------------------
// VALIDAR DÍA (viernes y sábado)
// --------------------------
function diaPermitido(fecha) {
  const dia = new Date(fecha).getDay();
  return dia === 5 || dia === 6;
}

// --------------------------
// OBTENER HORAS OCUPADAS FIRESTORE
// --------------------------
async function obtenerHorasOcupadas(fecha) {
  const q = query(collection(db, "citas"), where("fecha", "==", fecha));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data().hora);
}

// --------------------------
// GENERAR HORAS EN CARDS
// --------------------------
async function generarHoras() {
  horasContainer.innerHTML = "";
  horaSeleccionada = null;

  const fecha = fechaInput.value;
  if (!fecha || !servicioSeleccionado) return;

  if (!diaPermitido(fecha)) {
    estado.textContent = "❌ Solo se puede reservar viernes y sábados";
    estado.classList.add("visible");
    fechaInput.value = "";
    return;
  }

  estado.classList.remove("visible");

  let horasOcupadas = [];
  try {
    horasOcupadas = await obtenerHorasOcupadas(fecha);
    console.log("Horas ocupadas:", horasOcupadas); // debug
  } catch (err) {
    console.error("Error obteniendo horas:", err);
  }

  let hora = HORA_INICIO;
  let minuto = 0;

  while (true) {
    const inicio = hora * 60 + minuto;
    const fin = inicio + servicioSeleccionado.duracion;
    if (fin > HORA_FIN * 60) break;

    const h = hora.toString().padStart(2, "0");
    const m = minuto.toString().padStart(2, "0");
    const texto = `${h}:${m}`;

    const card = document.createElement("div");
    card.className = "hora-card";
    card.textContent = texto;

    if (horasOcupadas.includes(texto)) {
      card.classList.add("ocupada");
    } else {
      card.addEventListener("click", () => {
        document.querySelectorAll(".hora-card").forEach(c => c.classList.remove("activa"));
        card.classList.add("activa");
        horaSeleccionada = texto;
      });
    }

    horasContainer.appendChild(card);

    minuto += BLOQUE;
    if (minuto === 60) {
      minuto = 0;
      hora++;
    }
  }
}

fechaInput.addEventListener("change", async () => {
  await generarHoras();
});

// --------------------------
// ENVÍO DEL FORMULARIO
// --------------------------
form.addEventListener("submit", async e => {
  e.preventDefault();

  const nombre = document.getElementById("nombre").value;
  const telefono = document.getElementById("telefono").value;
  const email = document.getElementById("email").value;
  const fecha = fechaInput.value;

  if (!servicioSeleccionado) {
    estado.textContent = "❌ Selecciona un servicio";
    estado.classList.add("visible");
    return;
  }

  if (!horaSeleccionada) {
    estado.textContent = "❌ Selecciona una hora";
    estado.classList.add("visible");
    return;
  }

  // --------------------------
  // GUARDAR CITA EN FIRESTORE
  // --------------------------
  await addDoc(collection(db, "citas"), {
    nombre,
    telefono,
    email,
    fecha,
    hora: horaSeleccionada,
    servicio: servicioSeleccionado.nombre,
    precio: servicioSeleccionado.precio
  });

  // --------------------------
  // MOSTRAR CONFIRMACIÓN
  // --------------------------
  document.getElementById("cServicio").textContent = servicioSeleccionado.nombre;
  document.getElementById("cFecha").textContent = fecha;
  document.getElementById("cHora").textContent = horaSeleccionada;
  document.getElementById("cPrecio").textContent = servicioSeleccionado.precio;

  document.getElementById("confirmacion").classList.remove("oculto");

  // --------------------------
  // ENVIAR EMAILS (EmailJS)
  // --------------------------
  enviarEmails({
    nombre,
    telefono,
    email,
    fecha,
    hora: horaSeleccionada,
    servicio: servicioSeleccionado.nombre,
    precio: servicioSeleccionado.precio
  });

  // Volver a generar horas para bloquear la ocupada
  await generarHoras();
});

// --------------------------
// ENVIAR EMAILS
// --------------------------
function enviarEmails(datos) {
  // Cliente
  emailjs.send(
    "eKREmJniad6a8BOJa",
    "confirmacion_cliente",
    {
      nombre: datos.nombre,
      fecha: datos.fecha,
      hora: datos.hora,
      servicio: datos.servicio,
      precio: datos.precio,
      email: datos.email
    }
  );

  // Barbero
  emailjs.send(
    "eKREmJniad6a8BOJa",
    "nueva_cita_barbero",
    {
      nombre: datos.nombre,
      telefono: datos.telefono,
      fecha: datos.fecha,
      hora: datos.hora,
      servicio: datos.servicio,
      precio: datos.precio
    }
  );
}

// --------------------------
// CERRAR CONFIRMACIÓN
// --------------------------
function cerrarConfirmacion() {
  document.getElementById("confirmacion").classList.add("oculto");
}
