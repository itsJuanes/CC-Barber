const form = document.getElementById("citaForm");
const fechaInput = document.getElementById("fecha");
const horaSelect = document.getElementById("hora");
const servicioSelect = document.getElementById("servicio");
const estado = document.getElementById("estado");

// Configuración
const HORA_INICIO = 14;
const HORA_FIN = 22; // última cita empieza a las 21:30
const BLOQUE = 30;

// Bloquear fechas pasadas
const hoy = new Date().toISOString().split("T")[0];
fechaInput.min = hoy;

// Generar horas según duración del servicio
function generarHoras(duracion) {
  horaSelect.innerHTML = `<option value="">Selecciona una hora</option>`;

  let hora = HORA_INICIO;
  let minuto = 0;

  while (true) {
    const inicio = hora * 60 + minuto;
    const fin = inicio + duracion;

    if (fin > HORA_FIN * 60) break;

    const h = hora.toString().padStart(2, "0");
    const m = minuto.toString().padStart(2, "0");
    const valor = `${h}:${m}`;

    horaSelect.innerHTML += `<option value="${valor}">${valor}</option>`;

    minuto += BLOQUE;
    if (minuto === 60) {
      minuto = 0;
      hora++;
    }
  }
}

// Solo viernes y sábados
function diaPermitido(fecha) {
  const dia = new Date(fecha).getDay();
  return dia === 5 || dia === 6;
}

// Actualizar horas cuando cambia fecha o servicio
function actualizarHoras() {
  const fecha = fechaInput.value;
  const servicio = servicioSelect.value;

  horaSelect.innerHTML = `<option value="">Selecciona una hora</option>`;

  if (!fecha || !servicio) return;

  if (!diaPermitido(fecha)) {
    estado.textContent = "❌ Solo se puede reservar viernes y sábados";
    estado.classList.add("visible");
    fechaInput.value = "";
    return;
  }

  const [duracion] = servicio.split("|").map(Number);
  generarHoras(duracion);
  estado.classList.remove("visible");
}

fechaInput.addEventListener("change", actualizarHoras);
servicioSelect.addEventListener("change", actualizarHoras);

// Enviar formulario
form.addEventListener("submit", function (e) {
  e.preventDefault();

  const nombre = document.getElementById("nombre").value;
  const telefono = document.getElementById("telefono").value;
  const fecha = fechaInput.value;
  const hora = horaSelect.value;
  const servicio = servicioSelect.value;

  if (!fecha || !hora || !servicio) {
    estado.textContent = "❌ Completa todos los campos";
    estado.classList.add("visible");
    return;
  }

  const [duracion, precio] = servicio.split("|");

  const ahora = new Date();
  const fechaHoraCita = new Date(`${fecha}T${hora}`);

  if (fechaHoraCita <= ahora) {
    estado.textContent = "❌ Esa hora ya ha pasado";
    estado.classList.add("visible");
    return;
  }

  estado.textContent = "Preparando tu cita...";
  estado.classList.add("visible");

  setTimeout(() => {
    const mensaje =
      `Hola ${nombre}, tu cita en la barbería es el ${fecha} a las ${hora}.\n` +
      `Servicio: ${duracion} min\nPrecio: ${precio}€`;

    const whatsapp =
      `https://wa.me/34${telefono}?text=${encodeURIComponent(mensaje)}`;

    window.open(whatsapp, "_blank");
    estado.textContent = "Cita lista ✅";
  }, 800);
});
