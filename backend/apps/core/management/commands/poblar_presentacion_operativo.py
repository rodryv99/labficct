"""Segunda pasada de poblado: la parte operativa del sistema, para que la demo se
vea viva. Úsalo DESPUÉS de poblar_presentacion.

    docker compose exec backend python manage.py poblar_presentacion_operativo

Carga reservas (el auditorio con más), objetos perdidos (3–6 por día, con foto
generada cuando se puede), solicitudes de asistencia técnica, bitácora e
incidencias, tareas y revisiones programadas. Volúmenes pensados según los
laboratorios y auxiliares que ya existen: realista, ni vacío ni recargado.

Es idempotente: se puede correr varias veces sin duplicar. Los choques de reserva
no son un error: la reserva queda «por aprobar» (así lo maneja el sistema).
"""

import io
import random
from datetime import datetime, time, timedelta

from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.asistencia import services as asistencia
from apps.asistencia.models import SolicitudAsistencia
from apps.bitacora.models import EntradaBitacora, RevisionProgramada
from apps.bitacora.services import revisiones_vencidas
from apps.core.errores import ErrorNegocio
from apps.core.roles import Rol
from apps.laboratorios.models import Laboratorio, Software
from apps.objetos_perdidos import services as objetos
from apps.objetos_perdidos.models import ObjetoPerdido
from apps.planificacion import services as planificacion
from apps.planificacion.models import EstadoReserva, Reserva
from apps.tareas import services as tareas
from apps.tareas.models import Tarea
from apps.usuarios.models import Usuario


def _imagen(texto: str, color: tuple[int, int, int]):
    """Genera una imagen simple (color + texto) para el objeto perdido.
    Si Pillow no está disponible, devuelve None y el objeto queda sin foto."""
    try:
        from PIL import Image, ImageDraw
    except Exception:
        return None
    img = Image.new("RGB", (480, 360), color)
    dibujo = ImageDraw.Draw(img)
    dibujo.rectangle([12, 12, 467, 347], outline=(255, 255, 255), width=3)
    dibujo.text((28, 28), texto, fill=(255, 255, 255))
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    return ContentFile(buffer.getvalue(), name="objeto.png")


COLORES = [(3, 68, 129), (122, 62, 157), (46, 125, 91), (190, 18, 60), (37, 99, 235), (138, 90, 43)]

# ── Objetos perdidos: por categoría, descripción + característica ──
CATALOGO_OBJETOS = {
    "electronico": [
        ("Cargador de laptop", "Marca HP, punta tipo barril"),
        ("Mouse inalámbrico", "Logitech negro, con su receptor USB"),
        ("Audífonos", "In-ear blancos con estuche"),
        ("Power bank", "10000 mAh, color azul"),
        ("Memoria USB 32 GB", "Kingston, tapa plateada"),
        ("Cable HDMI", "2 metros, negro"),
        ("Calculadora científica", "Casio fx-991, funda negra"),
    ],
    "documento": [
        ("Carnet universitario", "A nombre de un estudiante de Informática"),
        ("Cédula de identidad", "Dentro de una funda de plástico"),
        ("Carnet de biblioteca", "Con código de barras"),
        ("Hoja de inscripción", "Doblada en cuatro"),
    ],
    "llaves": [
        ("Llavero con tres llaves", "Llavero de goma rojo"),
        ("Llave con candado pequeño", "Marca Yale"),
    ],
    "ropa": [
        ("Chamarra azul", "Talla M, con capucha"),
        ("Gorra negra", "Logo bordado al frente"),
        ("Paraguas plegable", "Color gris oscuro"),
        ("Bufanda", "Tejida, a rayas"),
    ],
    "accesorio": [
        ("Mochila negra", "Marca Totto, con llavero"),
        ("Botella de agua", "Térmica, color verde"),
        ("Estuche de lentes", "Rígido, color café"),
        ("Reloj de pulsera", "Correa de cuero"),
    ],
    "utiles": [
        ("Cuaderno universitario", "Tapa dura, 200 hojas"),
        ("Estuche con lápices", "Varios colores"),
        ("Libro de Cálculo I", "Con anotaciones a lápiz"),
        ("Juego de marcadores", "Para pizarra, 4 colores"),
    ],
    "otro": [
        ("Taza térmica", "Acero inoxidable"),
        ("Lonchera", "Con un táper dentro"),
    ],
}
# Categorías con foto (cosas que se fotografían); documentos/llaves a veces no.
CON_FOTO = {"electronico", "accesorio", "ropa", "utiles"}

NOMBRES_ESTUDIANTE = [
    "Luis Fernández", "María Gutiérrez", "Carlos Rojas", "Ana Villarroel",
    "Jorge Camacho", "Daniela Suárez", "Pedro Mamani", "Sofía Áñez",
    "Andrés Flores", "Valeria Ortiz", "Diego Terrazas", "Camila Peña",
]

LUGARES = ["Debajo de la PC-{n}", "En el escritorio docente", "Cerca de la puerta",
           "En la silla de la fila {n}", "Sobre la mesa del fondo", "Junto al proyector"]

# ── Asistencia técnica: (categoría, descripción) ──
PROBLEMAS = [
    ("equipo", "La PC-{n} no enciende."),
    ("equipo", "La computadora de la fila {n} se reinicia sola."),
    ("proyector", "El proyector no muestra imagen desde mi laptop."),
    ("proyector", "No se escucha el audio en el aula."),
    ("red", "No hay internet en el laboratorio."),
    ("red", "La red está muy lenta, no cargan las páginas."),
    ("software", "Falta instalar Python en varias PCs."),
    ("software", "El antivirus bloquea el compilador."),
    ("acceso", "Necesito que me abran el aula para el examen."),
    ("acceso", "No puedo cerrar el laboratorio, la cerradura falla."),
]

# ── Bitácora: (tipo, título, descripción, elementos) ──
ENTRADAS_BITACORA = [
    ("instalacion", "Instalación de Python 3.13", "Con pip y VS Code en todas las máquinas.", "PC-01 a PC-30"),
    ("instalacion", "Actualización de Visual Studio Code", "Se actualizó a la última versión.", "PC-01 a PC-20"),
    ("incidencia", "La PC-07 no enciende", "Fuente quemada; se reportó a soporte.", "PC-07"),
    ("incidencia", "Proyector sin señal", "Cable HDMI dañado, se solicitó repuesto.", "PROY-01"),
    ("mantenimiento", "Cambio de fuente de la PC-07", "Quedó operativa.", "PC-07"),
    ("mantenimiento", "Limpieza de ventiladores", "Se limpiaron los equipos de las primeras filas.", "PC-01 a PC-12"),
    ("limpieza", "Limpieza general del laboratorio", "Teclados y pantallas.", ""),
    ("revision", "Revisión de equipos", "Todo en orden, sin novedades.", ""),
    ("incidencia", "Teclado con teclas pegadas", "Se cambió por uno de repuesto.", "PC-15"),
]


class Command(BaseCommand):
    help = "Puebla reservas, objetos perdidos, asistencia, bitácora, tareas y revisiones (parte operativa)."

    def handle(self, *args, **options):
        self.rng = random.Random(2026)
        self.hoy = timezone.localdate()
        self.admin = (
            Usuario.objects.filter(is_superuser=True).order_by("pk").first()
            or Usuario.objects.filter(rol=Rol.ADMIN).order_by("pk").first()
        )
        self.labs = {lab.codigo: lab for lab in Laboratorio.objects.filter(activo=True)}
        self.labs_clase = [l for c, l in self.labs.items() if c not in ("236-40",)]  # sin auditorio
        self.auditorio = self.labs.get("236-40")
        self.auxiliares = list(Usuario.objects.filter(rol=Rol.AUXILIAR, is_active=True).order_by("pk"))
        self.docentes = list(Usuario.objects.filter(rol=Rol.DOCENTE, is_active=True).order_by("pk"))
        self.administrativos = list(Usuario.objects.filter(rol=Rol.ADMINISTRATIVO, is_active=True).order_by("pk"))
        self.software = list(Software.objects.all()[:5])

        if not self.auxiliares or not self.labs:
            self.stdout.write(self.style.ERROR(
                "Faltan auxiliares o laboratorios. Corré primero poblar_presentacion."))
            return

        self._reservas()
        self._objetos()
        self._asistencia()
        self._bitacora()
        self._revisiones()
        self._tareas()
        # Las revisiones ya vencidas pasan al pizarrón de tareas.
        creadas = revisiones_vencidas()
        self.stdout.write(self.style.SUCCESS(f"Parte operativa lista. Revisiones que pasaron al pizarrón: {creadas}."))

    # ── Utilidades ──
    def _dt(self, dia, h, m=0):
        return timezone.make_aware(datetime.combine(dia, time(h, m)))

    def _algunos_aux(self, n):
        return self.rng.sample(self.auxiliares, min(n, len(self.auxiliares)))

    def _solicitante(self):
        pool = self.docentes + self.administrativos
        return self.rng.choice(pool) if pool else self.admin

    # ── Reservas ──
    def _reservas(self):
        if self.auditorio is None:
            self.stdout.write(self.style.WARNING("No hay auditorio (236-40); las reservas de auditorio se omiten."))
        aud = self.auditorio
        H = self.hoy
        d = lambda n: H + timedelta(days=n)

        reservas = []
        if aud:
            reservas += [
                # El auditorio concentra exámenes masivos y conferencias.
                dict(titulo="Examen final de Programación I (INF120)", solicitante_externo="Jefatura de carrera",
                     requiere_apoyo=True, auxiliares_requeridos=2,
                     bloques=[dict(laboratorio=aud, fecha=d(14), hora_inicio=time(8, 0), hora_fin=time(11, 0))]),
                dict(titulo="Examen final de Estructura de Datos I (INF220)", solicitante_externo="Jefatura de carrera",
                     requiere_apoyo=True, auxiliares_requeridos=2,
                     bloques=[dict(laboratorio=aud, fecha=d(16), hora_inicio=time(8, 0), hora_fin=time(11, 0))]),
                dict(titulo="Conferencia: Inteligencia Artificial en Bolivia", solicitante_externo="Centro de Estudiantes",
                     requiere_apoyo=True, auxiliares_requeridos=1,
                     bloques=[dict(laboratorio=aud, fecha=d(9), hora_inicio=time(15, 0), hora_fin=time(18, 0))]),
                dict(titulo="Defensa de Taller de Grado I", solicitante_externo="Tribunal de grado",
                     bloques=[dict(laboratorio=aud, fecha=d(21), hora_inicio=time(9, 0), hora_fin=time(12, 0))]),
                dict(titulo="Olimpiada de Programación FICCT", solicitante_externo="Dirección de carrera",
                     requiere_apoyo=True, auxiliares_requeridos=3,
                     bloques=[dict(laboratorio=aud, fecha=d(25), hora_inicio=time(8, 0), hora_fin=time(17, 0))]),
                dict(titulo="Charla de Ciberseguridad", solicitante_externo="Empresa invitada",
                     bloques=[dict(laboratorio=aud, fecha=d(-10), hora_inicio=time(16, 0), hora_fin=time(18, 0))]),
                dict(titulo="Examen de admisión", solicitante_externo="Facultad",
                     requiere_apoyo=True, auxiliares_requeridos=2,
                     bloques=[dict(laboratorio=aud, fecha=d(-20), hora_inicio=time(8, 0), hora_fin=time(12, 0))]),
                dict(titulo="Congreso de Ingeniería de Sistemas", solicitante_externo="FICCT",
                     requiere_apoyo=True, auxiliares_requeridos=2,
                     bloques=[
                         dict(laboratorio=aud, fecha=d(28), hora_inicio=time(9, 0), hora_fin=time(12, 0)),
                         dict(laboratorio=aud, fecha=d(29), hora_inicio=time(9, 0), hora_fin=time(12, 0)),
                     ]),
            ]
        # Un par en laboratorios normales, en sábado (libres), quedan confirmadas.
        sabado = H + timedelta(days=(5 - H.weekday()) % 7 or 7)
        if "236-44" in self.labs:
            reservas.append(dict(
                titulo="Taller de Git y GitHub", solicitante_externo="Centro de Estudiantes",
                requiere_apoyo=True, auxiliares_requeridos=1,
                bloques=[dict(laboratorio=self.labs["236-44"], fecha=sabado, hora_inicio=time(9, 0), hora_fin=time(12, 0))],
                programas=self.software[:1]))
        if "236-46" in self.labs:
            reservas.append(dict(
                titulo="Curso de Python para docentes", solicitante=self.docentes[0] if self.docentes else None,
                bloques=[dict(laboratorio=self.labs["236-46"], fecha=sabado, hora_inicio=time(14, 0), hora_fin=time(17, 0))]))
            # Una que choca con una clase: queda «por aprobar» (demuestra ese flujo).
            reservas.append(dict(
                titulo="Examen de recuperación INF110", solicitante_externo="Docente invitado",
                bloques=[dict(laboratorio=self.labs["236-46"], fecha=d(7), hora_inicio=time(10, 0), hora_fin=time(11, 0))]))

        confirmadas = pendientes = 0
        for datos in reservas:
            if Reserva.objects.filter(titulo=datos["titulo"]).exclude(estado=EstadoReserva.CANCELADA).exists():
                continue
            datos = dict(datos)
            if datos.get("requiere_apoyo"):
                datos["auxiliares"] = self._algunos_aux(datos.get("auxiliares_requeridos", 1))
            try:
                reserva, _ = planificacion.guardar_reserva(reserva=None, datos=datos, usuario=self.admin)
                if reserva.estado == EstadoReserva.CONFIRMADA:
                    confirmadas += 1
                else:
                    pendientes += 1
            except ErrorNegocio as e:
                self.stdout.write(self.style.WARNING(f"  Reserva omitida ({datos['titulo']}): {e.mensaje}"))
        self.stdout.write(f"Reservas: {confirmadas} confirmadas, {pendientes} por aprobar.")

    # ── Objetos perdidos ──
    def _objetos(self):
        categorias = list(CATALOGO_OBJETOS.keys())
        creados = entregados = anulados = 0
        for atras in range(1, 19):  # últimos 18 días
            dia = self.hoy - timedelta(days=atras)
            cuantos = self.rng.randint(3, 6)
            for _ in range(cuantos):
                categoria = self.rng.choice(categorias)
                descripcion, caracteristica = self.rng.choice(CATALOGO_OBJETOS[categoria])
                lab = self.rng.choice(self.labs_clase)
                lugar = self.rng.choice(LUGARES).replace("{n}", str(self.rng.randint(1, 30)))
                fecha = self._dt(dia, self.rng.randint(7, 21), self.rng.choice([0, 15, 30, 45]))
                if ObjetoPerdido.objects.filter(descripcion=descripcion, fecha_hallazgo=fecha).exists():
                    continue
                datos = dict(
                    descripcion=descripcion, categoria=categoria, caracteristicas=caracteristica,
                    laboratorio=lab, lugar=lugar, fecha_hallazgo=fecha,
                    encontrado_por=self.rng.choice(["Auxiliar de turno", "Personal de limpieza", "Un estudiante"]),
                )
                if categoria in CON_FOTO:
                    foto = _imagen(f"{descripcion}\n{lab.codigo}", self.rng.choice(COLORES))
                    if foto:
                        datos["foto"] = foto
                objeto = objetos.registrar(datos=datos, usuario=self.rng.choice(self.auxiliares))
                creados += 1
                # Algunos se entregan, pocos se anulan, el resto queda en custodia.
                suerte = self.rng.random()
                if atras >= 3 and suerte < 0.40:
                    objetos.entregar(
                        objeto=objeto, entregado_a=self.rng.choice(NOMBRES_ESTUDIANTE),
                        entregado_ci=str(self.rng.randint(7000000, 9999999)),
                        observacion="", usuario=self.rng.choice(self.auxiliares))
                    entregados += 1
                elif suerte > 0.92:
                    objetos.anular(
                        objeto=objeto,
                        motivo=self.rng.choice([
                            "Registrado por error.", "Objeto duplicado.",
                            "El dueño lo retiró antes de completar el registro."]),
                        usuario=self.admin)
                    anulados += 1
        self.stdout.write(f"Objetos perdidos: {creados} creados ({entregados} entregados, {anulados} anulados, "
                          f"{creados - entregados - anulados} en custodia).")

    # ── Asistencia técnica ──
    def _asistencia(self):
        creadas = 0
        objetivo = max(12, len(self.labs_clase) + 6)
        for i in range(objetivo):
            categoria, plantilla = PROBLEMAS[i % len(PROBLEMAS)]
            descripcion = plantilla.replace("{n}", str(self.rng.randint(1, 30)))
            solicitante = self._solicitante()
            lab = self.rng.choice(self.labs_clase)
            if SolicitudAsistencia.objects.filter(
                    descripcion=descripcion, laboratorio=lab, solicitante=solicitante).exists():
                continue
            try:
                solicitud = asistencia.solicitar(
                    datos=dict(laboratorio=lab, categoria=categoria, descripcion=descripcion,
                               urgente=self.rng.random() < 0.25),
                    usuario=solicitante)
            except ErrorNegocio:
                continue
            creadas += 1
            # ~40% resueltas, ~25% en camino, el resto pendientes.
            suerte = self.rng.random()
            aux = self.rng.choice(self.auxiliares)
            if suerte < 0.40:
                asistencia.tomar(solicitud=solicitud, usuario=aux)
                asistencia.resolver(solicitud=solicitud, usuario=aux,
                                    respuesta=self.rng.choice([
                                        "Resuelto, se reinició el equipo.",
                                        "Se cambió el cable y quedó funcionando.",
                                        "Se reportó a soporte técnico.",
                                        "Listo, ya hay internet."]))
            elif suerte < 0.65:
                asistencia.tomar(solicitud=solicitud, usuario=aux)
        self.stdout.write(f"Solicitudes de asistencia técnica: {creadas}.")

    # ── Bitácora e incidencias ──
    def _bitacora(self):
        creadas = 0
        labs = self.labs_clase
        for i, lab in enumerate(labs):
            # 2 a 3 entradas por laboratorio.
            for j in range(self.rng.randint(2, 3)):
                tipo, titulo, descripcion, elementos = ENTRADAS_BITACORA[(i + j) % len(ENTRADAS_BITACORA)]
                fecha = self._dt(self.hoy - timedelta(days=self.rng.randint(1, 25)),
                                 self.rng.randint(8, 18), self.rng.choice([0, 30]))
                if EntradaBitacora.objects.filter(laboratorio=lab, titulo=titulo, fecha=fecha).exists():
                    continue
                autor = self.rng.choice(self.auxiliares)
                EntradaBitacora.objects.create(
                    laboratorio=lab, tipo=tipo, titulo=titulo, descripcion=descripcion,
                    elementos=elementos, fecha=fecha, creado_por=autor, actualizado_por=autor)
                creadas += 1
        self.stdout.write(f"Entradas de bitácora: {creadas}.")

    # ── Revisiones programadas ──
    def _revisiones(self):
        plan = [
            ("Revisión de equipos", 2, "semanas", -2),   # vencida (pasa al pizarrón)
            ("Revisión del proyector y audio", 1, "meses", 5),
            ("Revisión de red y cableado", 1, "meses", -1),  # vencida
            ("Limpieza profunda de equipos", 3, "semanas", 9),
            ("Revisión de licencias de software", 1, "meses", 14),
            ("Chequeo de tomas de corriente", 2, "semanas", 3),
        ]
        creadas = 0
        labs = self.labs_clase
        for i, (titulo, cada, unidad, dias) in enumerate(plan):
            lab = labs[i % len(labs)]
            if RevisionProgramada.objects.filter(laboratorio=lab, titulo=titulo).exists():
                continue
            responsable = self.rng.choice(self.auxiliares) if self.rng.random() < 0.6 else None
            RevisionProgramada.objects.create(
                laboratorio=lab, titulo=titulo,
                instrucciones="Encender cada equipo, probar teclado, mouse, red y proyector. Anotar fallas.",
                cada=cada, unidad=unidad, proxima_fecha=self.hoy + timedelta(days=dias),
                responsable=responsable, creado_por=self.admin, actualizado_por=self.admin)
            creadas += 1
        self.stdout.write(f"Revisiones programadas: {creadas}.")

    # ── Tareas (pizarrón de auxiliares) ──
    def _tareas(self):
        if Tarea.objects.exclude(revision__isnull=False).exists():
            # Ya hay tareas (que no son de revisión): no duplicar.
            pass
        labs = self.labs_clase
        plantillas = [
            ("Cambiar cable HDMI del proyector", "El del laboratorio falla si se mueve.", "alta", "pendiente", 0),
            ("Instalar Docker Desktop", "Para la materia de Redes.", "normal", "en_progreso", 40),
            ("Ordenar el depósito de cables", "", "baja", "pendiente", 0),
            ("Reponer marcadores de pizarra", "Quedan pocos en varias aulas.", "normal", "pendiente", 0),
            ("Etiquetar las PCs nuevas", "Poner PC-## en las máquinas del fondo.", "normal", "en_progreso", 60),
            ("Revisar el aire acondicionado", "Hace ruido al encender.", "alta", "hecha", 100),
            ("Actualizar el inventario del LAB", "Contrastar con lo que hay físicamente.", "normal", "pendiente", 0),
            ("Formatear las PCs con fallas", "Las que reportaron en bitácora.", "normal", "en_progreso", 25),
        ]
        creadas = 0
        for i, (titulo, desc, prioridad, estado, progreso) in enumerate(plantillas):
            if Tarea.objects.filter(titulo=titulo).exists():
                continue
            lab = labs[i % len(labs)]
            responsables = self._algunos_aux(self.rng.randint(1, 2))
            tarea = tareas.crear_tarea(
                datos=dict(titulo=titulo, descripcion=desc, prioridad=prioridad, laboratorio=lab,
                           fecha_limite=self.hoy + timedelta(days=self.rng.randint(1, 10)),
                           responsables=responsables),
                usuario=self.admin)
            creadas += 1
            if estado == "en_progreso":
                tareas.agregar_avance(tarea=tarea, usuario=responsables[0],
                                      texto=f"Avanzando: {progreso}% listo.", progreso=progreso)
            elif estado == "hecha":
                tareas.cambiar_estado(tarea=tarea, estado="hecha", usuario=responsables[0],
                                      nota="Terminado y probado.")
        self.stdout.write(f"Tareas: {creadas}.")
