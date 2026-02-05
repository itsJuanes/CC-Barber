// --------------------------
// IMPORTS FIREBASE (v10+)
// --------------------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
emailjs.init("eKREmJniad6a8BOJa"); // Tu Public Key va AQUÍ una sola vez

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
const HORA_INICIO = 14; // 14:00
const HORA_FIN = 22;    // 22:00
const BLOQUE = 30;      // 30 minutos

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

    // Regenerar horas porque la duración puede afectar la disponibilidad
    generarHoras();
  });
});

// --------------------------
// VALIDAR DÍA (viernes y sábado)
// --------------------------
function diaPermitido(fechaString) {
  // Truco: Agregar T00:00:00 fuerza al navegador a usar hora local del usuario
  // en lugar de UTC, evitando que el día "baile" hacia atrás.
  const fechaObj = new Date(fechaString + "T00:00:00");
  const dia = fechaObj.getDay();
  // 5 = Viernes, 6 = Sábado
  return dia === 5 || dia === 6;
}

// --------------------------
// CONVERTIR HORA TEXTO A MINUTOS
// --------------------------
function horaAMinutos(horaTexto) {
  const [h, m] = horaTexto.split(":").map(Number);
  return h * 60 + m;
}

function minutosAHora(minutosTotal) {
  const h = Math.floor(minutosTotal / 60).toString().padStart(2, "0");
  const m = (minutosTotal % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

// --------------------------
// OBTENER HORAS OCUPADAS FIRESTORE
// --------------------------
async function obtenerIntervalosOcupados(fecha) {
  const q = query(collection(db, "citas"), where("fecha", "==", fecha));
  const snapshot = await getDocs(q);
  
  let intervalos = [];

  snapshot.forEach(doc => {
    const data = doc.data();
    // Si la cita antigua no tiene duración guardada, asumimos 30 min por defecto
    const duracionCita = data.duracion || 30; 
    const inicioMin = horaAMinutos(data.hora);
    const finMin = inicioMin + duracionCita;

    intervalos.push({ inicio: inicioMin, fin: finMin });
  });

  return intervalos;
}

// --------------------------
// GENERAR HORAS EN CARDS
// --------------------------
async function generarHoras() {
  horasContainer.innerHTML = "";
  horaSeleccionada = null;

  const fecha = fechaInput.value;
  
  // No generamos nada si falta fecha o servicio
  if (!fecha || !servicioSeleccionado) return;

  if (!diaPermitido(fecha)) {
    estado.textContent = "❌ Solo se puede reservar viernes y sábados";
    estado.classList.add("visible");
    // Opcional: limpiar fecha incorrecta
    // fechaInput.value = ""; 
    return;
  }

  estado.classList.remove("visible");

  // Añadimos indicador de carga
  horasContainer.innerHTML = "<p style='grid-column: 1/-1; text-align:center;'>Cargando disponibilidad...</p>";

  let intervalosOcupados = [];
  try {
    intervalosOcupados = await obtenerIntervalosOcupados(fecha);
  } catch (err) {
    console.error("Error obteniendo horas:", err);
    estado.textContent = "Error de conexión con la base de datos";
    estado.classList.add("visible");
    return;
  }

  horasContainer.innerHTML = ""; // Limpiar carga

  let horaActualMinutos = HORA_INICIO * 60;
  const horaFinMinutos = HORA_FIN * 60;

  while (horaActualMinutos < horaFinMinutos) {
    const textoHora = minutosAHora(horaActualMinutos);
    
    // Crear lógica de ocupación REAL
    // Una hora está ocupada si:
    // 1. El bloque actual cae dentro de una cita existente.
    // 2. O SI yo reservo ahora (con mi duración), choco con una cita futura.
    
    let estaOcupada = false;

    // A: Verificar si este bloque ya está cogido por alguien
    for (let intervalo of intervalosOcupados) {
      // Si el inicio del bloque actual es >= inicio cita Y < fin cita
      if (horaActualMinutos >= intervalo.inicio && horaActualMinutos < intervalo.fin) {
        estaOcupada = true;
        break;
      }
    }

    // B: Verificar si MI servicio cabe aquí sin chocar con la siguiente cita
    if (!estaOcupada) {
        const finDeMiCita = horaActualMinutos + servicioSeleccionado.duracion;
        
        // Si mi cita termina después de la hora de cierre
        if (finDeMiCita > horaFinMinutos) {
            estaOcupada = true; // No cabe por cierre
        } else {
            // Si mi cita choca con el INICIO de otra cita ya agendada
            for (let intervalo of intervalosOcupados) {
                // Si mi final se pasa del inicio de otra cita (y mi inicio es antes de esa cita)
                if (finDeMiCita > intervalo.inicio && horaActualMinutos < intervalo.inicio) {
                    estaOcupada = true;
                    break;
                }
            }
        }
    }

    // Renderizar Card
    const card = document.createElement("div");
    card.className = "hora-card";
    card.textContent = textoHora;

    if (estaOcupada) {
      card.classList.add("ocupada");
    } else {
      card.addEventListener("click", () => {
        document.querySelectorAll(".hora-card").forEach(c => c.classList.remove("activa"));
        card.classList.add("activa");
        horaSeleccionada = textoHora;
      });
    }

    horasContainer.appendChild(card);

    horaActualMinutos += BLOQUE;
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

  // Deshabilitar botón para evitar doble click
  const btnSubmit = form.querySelector("button[type='submit']");
  btnSubmit.disabled = true;
  btnSubmit.textContent = "Procesando...";

  try {
      // --------------------------
      // GUARDAR CITA EN FIRESTORE
      // --------------------------
      // CORRECCIÓN IMPORTANTE: Guardamos la duración
      await addDoc(collection(db, "citas"), {
        nombre,
        telefono,
        email,
        fecha,
        hora: horaSeleccionada,
        servicio: servicioSeleccionado.nombre,
        precio: servicioSeleccionado.precio,
        duracion: servicioSeleccionado.duracion // <--- ESTO FALTABA
      });

      // --------------------------
      // MOSTRAR CONFIRMACIÓN
      // --------------------------
      // Asumiendo que existe el HTML para esto (no estaba en tu index.html original completo pero lo referenciabas)
      // Si no existe estos elementos en el DOM, daría error, así que verificamos uno.
      if(document.getElementById("cServicio")) {
          document.getElementById("cServicio").textContent = servicioSeleccionado.nombre;
          document.getElementById("cFecha").textContent = fecha;
          document.getElementById("cHora").textContent = horaSeleccionada;
          document.getElementById("cPrecio").textContent = servicioSeleccionado.precio + "€";
          document.getElementById("confirmacion").classList.remove("oculto");
      } else {
          Swal.fire({
            title: '¡Reserva Confirmada!',
            text: 'Te hemos enviado un correo con los detalles.',
            icon: 'success',
            iconColor: '#4CAF50', // Color del tick
            background: '#1a1a1a', // Fondo del modal
            color: '#ffffff',      // Color del texto
            confirmButtonText: 'Genial',
            confirmButtonColor: '#c59d5f' // Un dorado color "barber"
          }).then((result) => {
            if (result.isConfirmed) {
              // 1. Limpia el formulario completo
              document.getElementById("citaForm").reset();
    
              // 2. Resetea variables visuales de tu script
              servicioSeleccionado = null; 
              horaSeleccionada = null;
    
              // 3. Limpia el mensaje de estado si tenías alguno escrito
              document.getElementById("estado").textContent = "";
    
              // 4. Refresca las horas para que la que se acaba de reservar salga ocupada
              generarHoras();
            }
          });
      }

      // --------------------------
      // ENVIAR EMAILS (EmailJS)
      // --------------------------
      if (typeof emailjs !== 'undefined') {
          enviarEmails({
            nombre,
            telefono,
            email,
            fecha,
            hora: horaSeleccionada,
            servicio: servicioSeleccionado.nombre,
            precio: servicioSeleccionado.precio
          });
      }

      // Refrescar horas
      await generarHoras();

  } catch (error) {
      console.error(error);
      estado.textContent = "❌ Error al guardar la cita. Inténtalo de nuevo.";
      estado.classList.add("visible");
  } finally {
      btnSubmit.disabled = false;
      btnSubmit.textContent = "Confirmar cita";
  }
});

// --------------------------
// ENVIAR EMAILS
// --------------------------
function enviarEmails(datos) {
  // Cliente
  emailjs.send(
    "service_rd1j9nw",
    "template_hxk7kln",
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
    "service_rd1j9nw",
    "template_qygli6w",
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
// CANCELAR CITA
// --------------------------
async function cancelarCitaPorEmail(emailUsuario) {
  if (!emailUsuario) return alert("Por favor, introduce tu email");

  try {
    // 1. Buscar la cita en Firestore
    const q = query(collection(db, "citas"), where("email", "==", emailUsuario));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      estado.textContent = "❌ No se encontró ninguna cita con ese correo.";
      estado.style.color = "#e63946"; // Rojo error
      estado.classList.add("visible");

    // Opcional: ocultarlo tras 5 segundos
      setTimeout(() => {
         estado.classList.remove("visible");
      }, 5000);
      return;
    }

    // 2. Si existe, pedir confirmación
    const confirmar = confirm(`Hemos encontrado una cita a nombre de ${emailUsuario}. ¿Seguro que quieres cancelarla?`);
    
    if (confirmar) {
      // 3. Borrar el documento (o documentos si tiene varios)
      const { deleteDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
      
      querySnapshot.forEach(async (documento) => {
        await deleteDoc(doc(db, "citas", documento.id));
      });

      alert("Cita cancelada correctamente.");
      // Refrescar el calendario para liberar la hora
      generarHoras(); 
    }
  } catch (error) {
    console.error("Error al cancelar:", error);
    alert("Hubo un error al intentar cancelar la cita.");
  }
}

document.getElementById("btnCancelarCita").addEventListener("click", () => {
  const email = document.getElementById("emailCancelar").value;
  cancelarCitaPorEmail(email);
});

// Función global para cerrar modal si usas onclick en el HTML
window.cerrarConfirmacion = function() {
  const modal = document.getElementById("confirmacion");
  if(modal) modal.classList.add("oculto");
}