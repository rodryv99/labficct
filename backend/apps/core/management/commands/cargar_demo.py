"""Carga datos de ejemplo para probar la web y la app sin escribir todo a mano.

    docker compose exec backend python manage.py cargar_demo

Se puede ejecutar varias veces: no duplica lo que ya existe.
Todos los usuarios de ejemplo tienen la contraseña Ficct2026!
"""

from datetime import time, timedelta

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.asistencia import services as asistencia
from apps.asistencia.models import SolicitudAsistencia
from apps.bitacora.models import EntradaBitacora, RevisionProgramada
from apps.core.errores import ErrorNegocio
from apps.core.roles import Rol
from apps.laboratorios.models import (
    CredencialLaboratorio,
    ElementoLaboratorio,
    Laboratorio,
    Software,
    TipoElemento,
)
from apps.laboratorios.services import guardar_credencial
from apps.objetos_perdidos import services as objetos
from apps.objetos_perdidos.models import ObjetoPerdido
from apps.planificacion import services as planificacion
from apps.planificacion.models import Docente, EstadoReserva, Horario, Materia, PeriodoAcademico, Reserva
from apps.preferencias import services as preferencias
from apps.preferencias.models import OpcionPreferencia, PreferenciasDocente
from apps.tareas import services as tareas
from apps.tareas.models import Tarea
from apps.usuarios.models import Usuario

PASSWORD = "Ficct2026!"
DOMINIO = "demo.ficct.edu.bo"

USUARIOS = [
    ("jefe", "Jefe", "de Laboratorio", Rol.ADMIN),
    ("ana.rojas", "Ana", "Rojas Suárez", Rol.AUXILIAR),
    ("carlos.mendez", "Carlos", "Méndez Vaca", Rol.AUXILIAR),
    ("lucia.paz", "Lucía", "Paz Arteaga", Rol.AUXILIAR),
    ("mario.justiniano", "Mario", "Justiniano Roca", Rol.DOCENTE),
    ("silvia.antelo", "Silvia", "Antelo Cuéllar", Rol.DOCENTE),
    ("jorge.saucedo", "Jorge", "Saucedo Ribera", Rol.DOCENTE),
    ("patricia.vargas", "Patricia", "Vargas Montaño", Rol.ADMINISTRATIVO),
]

TIPOS = [
    # nombre, icono, categoría, color, prefijo
    ("Computadora", "pc", "equipo", "#034481", "PC"),
    ("Proyector", "proyector", "audiovisual", "#7A3E9D", "PRY"),
    ("Pizarra", "pizarra", "mobiliario", "#2E7D5B", ""),
    ("Escritorio docente", "mesa", "mobiliario", "#8A5A2B", ""),
    ("Impresora", "impresora", "equipo", "#4B5563", "IMP"),
    ("Switch", "router", "red", "#0E7490", "SW"),
    ("Aire acondicionado", "aire", "infraestructura", "#2563EB", "AC"),
    ("Puerta", "puerta", "infraestructura", "#6B7280", ""),
]

SOFTWARE = [
    ("Visual Studio Code", "1.104"),
    ("Python", "3.13"),
    ("Java JDK", "21"),
    ("NetBeans", "27"),
    ("MySQL Workbench", "8.0"),
    ("pgAdmin", "9"),
    ("Android Studio", "2025.1"),
    ("Cisco Packet Tracer", "8.2"),
    ("AutoCAD", "2026"),
    ("Microsoft Office", "365"),
]

MATERIAS = [
    ("INF-110", "Introducción a la Informática"),
    ("INF-120", "Programación I"),
    ("INF-210", "Programación II"),
    ("INF-220", "Estructuras de Datos I"),
    ("INF-310", "Estructuras de Datos II"),
    ("INF-312", "Base de Datos I"),
    ("INF-322", "Base de Datos II"),
    ("INF-342", "Sistemas de Información I"),
    ("INF-433", "Redes I"),
    ("INF-423", "Redes II"),
]

# Franjas de 2 h 15 de la FICCT (atención de 07:00 a 22:45).
FRANJAS = [
    (time(7, 0), time(9, 15)),
    (time(9, 15), time(11, 30)),
    (time(11, 30), time(13, 45)),
    (time(13, 45), time(16, 0)),
    (time(16, 0), time(18, 15)),
    (time(18, 15), time(20, 30)),
    (time(20, 30), time(22, 45)),
]


class Command(BaseCommand):
    help = "Carga datos de ejemplo (usuarios, laboratorios, horarios, reservas, objetos perdidos, tareas…)."

    @transaction.atomic
    def handle(self, *args, **options):
        self.usuarios = self._usuarios()
        self.admin = self.usuarios["jefe"]
        self.tipos = self._tipos()
        self.software = self._software()
        self.labs = self._laboratorios()
        periodo = self._periodo()
        self._horarios(periodo)
        self._reservas()
        self._objetos()
        self._preferencias()
        self._bitacora_y_revisiones()
        self._tareas()
        self._asistencia()
        self.stdout.write(self.style.SUCCESS("Datos de ejemplo listos."))
        self.stdout.write(f"Usuarios: <nombre>@{DOMINIO} · contraseña: {PASSWORD}")
        self.stdout.write(f"  Admin: jefe@{DOMINIO} · Auxiliar: ana.rojas@{DOMINIO} · Docente: mario.justiniano@{DOMINIO}")

    # ── Usuarios ──
    def _usuarios(self):
        resultado = {}
        for i, (alias, nombres, apellidos, rol) in enumerate(USUARIOS):
            usuario, creado = Usuario.objects.get_or_create(
                email=f"{alias}@{DOMINIO}",
                defaults={
                    "nombres": nombres,
                    "apellidos": apellidos,
                    "rol": rol,
                    "codigo": f"2190{i:05d}",
                    "telefono": f"7{i}1234{i}{i}",
                },
            )
            if creado:
                usuario.set_password(PASSWORD)
                usuario.save()
            resultado[alias] = usuario
        return resultado

    # ── Catálogos ──
    def _tipos(self):
        tipos = {}
        for nombre, icono, categoria, color, prefijo in TIPOS:
            tipos[icono], _ = TipoElemento.objects.get_or_create(
                nombre=nombre,
                defaults={
                    "icono": icono,
                    "categoria": categoria,
                    "color": color,
                    "prefijo_etiqueta": prefijo,
                    "creado_por": self.admin,
                },
            )
        return tipos

    def _software(self):
        return [
            Software.objects.get_or_create(nombre=n, version=v, defaults={"creado_por": self.admin})[0]
            for n, v in SOFTWARE
        ]

    # ── Laboratorios con su grilla ──
    def _laboratorios(self):
        definiciones = [
            ("LAB-1", "Laboratorio 1", "Módulo 236 · Planta baja", 7, 9, 40, "operativo"),
            ("LAB-2", "Laboratorio 2", "Módulo 236 · Planta baja", 6, 9, 32, "operativo"),
            ("LAB-3", "Laboratorio de Redes", "Módulo 236 · Primer piso", 6, 8, 24, "operativo"),
            ("LAB-4", "Laboratorio 4", "Módulo 236 · Primer piso", 7, 9, 40, "mantenimiento"),
        ]
        labs = {}
        for n, (codigo, nombre, ubicacion, filas, columnas, capacidad, estado) in enumerate(definiciones, 1):
            lab, creado = Laboratorio.objects.get_or_create(
                codigo=codigo,
                defaults={
                    "nombre": nombre,
                    "ubicacion": ubicacion,
                    "filas": filas,
                    "columnas": columnas,
                    "capacidad": capacidad,
                    "estado": estado,
                    "notas": "Llaves en la oficina de laboratorios. Limpieza: lunes y jueves, 13:00.",
                    "creado_por": self.admin,
                },
            )
            labs[codigo] = lab
            if creado:
                self._dibujar(lab, n)
                lab.software.set(self.software[:6] if codigo != "LAB-3" else self.software[:3] + self.software[7:8])
                guardar_credencial(
                    credencial=CredencialLaboratorio(
                        laboratorio=lab,
                        descripcion="Administrador de Windows",
                        usuario="Administrador",
                        creado_por=self.admin,
                    ),
                    password=f"{codigo}-Admin!",
                )
        return labs

    def _dibujar(self, lab, n):
        """Pizarra y proyector adelante, puerta en la esquina, filas de PCs con pasillo al centro."""
        t = self.tipos
        centro = lab.columnas // 2
        elementos = [
            (0, centro, t["pizarra"], ""),
            (0, lab.columnas - 1, t["puerta"], ""),
            (1, 0, t["mesa"], ""),
            (1, centro, t["proyector"], "PRY-01"),
            (1, lab.columnas - 1, t["aire"], "AC-01"),
        ]
        if lab.codigo == "LAB-3":
            elementos.append((1, 1, t["router"], "SW-01"))
        numero = 1
        for fila in range(2, lab.filas):
            for columna in range(lab.columnas):
                if columna == centro:
                    continue  # pasillo
                elementos.append((fila, columna, t["pc"], f"PC-{numero:02d}"))
                numero += 1

        ElementoLaboratorio.objects.bulk_create(
            [
                ElementoLaboratorio(
                    laboratorio=lab,
                    tipo=tipo,
                    fila=fila,
                    columna=columna,
                    etiqueta=etiqueta,
                    ip=f"192.168.{n}.{10 + i}" if tipo == t["pc"] else None,
                    especificaciones="Core i5, 16 GB RAM, SSD 512 GB" if tipo == t["pc"] else "",
                    estado="con_falla" if etiqueta in ("PC-07", "PC-18") else "operativo",
                    creado_por=self.admin,
                )
                for i, (fila, columna, tipo, etiqueta) in enumerate(elementos)
            ]
        )

    # ── Periodo y horarios ──
    def _periodo(self):
        hoy = timezone.localdate()
        inicio = hoy - timedelta(days=60 + hoy.weekday())
        nombre = f"{1 if hoy.month <= 6 else 2}-{hoy.year}"
        periodo, _ = PeriodoAcademico.objects.get_or_create(
            nombre=nombre,
            defaults={
                "fecha_inicio": inicio,
                "fecha_fin": hoy + timedelta(days=90),
                "vigente": True,
                "creado_por": self.admin,
            },
        )
        return periodo

    def _docentes(self):
        """Fichas de docente: una por cada usuario docente y una sin cuenta todavía."""
        fichas = [
            planificacion.asegurar_ficha_docente(usuario=u)
            for u in self.usuarios.values()
            if u.rol == Rol.DOCENTE
        ]
        sin_cuenta, _ = Docente.objects.get_or_create(
            email=f"roberto.anez@{DOMINIO}",
            defaults={"nombres": "Roberto", "apellidos": "Añez Suárez", "creado_por": self.admin},
        )
        return [*fichas, sin_cuenta]

    def _horarios(self, periodo):
        docentes = self._docentes()
        if Horario.objects.filter(periodo=periodo).exists():
            return
        materias = [
            Materia.objects.get_or_create(sigla=s, defaults={"nombre": n, "creado_por": self.admin})[0]
            for s, n in MATERIAS
        ]
        labs = [self.labs["LAB-1"], self.labs["LAB-2"], self.labs["LAB-3"]]
        contador = 0
        for dia in range(1, 6):  # lunes a viernes
            for indice_lab, lab in enumerate(labs):
                for f, (inicio, fin) in enumerate(FRANJAS):
                    # Deja huecos para que haya espacio libre en la pizarra.
                    if (dia + indice_lab + f) % 3 == 0:
                        continue
                    materia = materias[(dia * 3 + indice_lab * 2 + f) % len(materias)]
                    if lab.codigo == "LAB-3":
                        materia = materias[8 + (f % 2)]
                    Horario.objects.create(
                        periodo=periodo,
                        laboratorio=lab,
                        materia=materia,
                        grupo=["SA", "SB", "SC", "SD", "SE"][(dia + f) % 5],
                        docente=docentes[(dia + indice_lab + f) % len(docentes)],
                        dia_semana=dia,
                        hora_inicio=inicio,
                        hora_fin=fin,
                        creado_por=self.admin,
                    )
                    contador += 1
        self.stdout.write(f"Horarios creados: {contador}")

    # ── Reservas ──
    def _reservas(self):
        hoy = timezone.localdate()
        sabado = hoy + timedelta(days=(5 - hoy.weekday()) % 7 or 7)
        vs_code, python = self.software[0], self.software[1]
        ejemplos = [
            {
                "titulo": "Taller de Git y GitHub",
                "descripcion": "Taller abierto para estudiantes de primer semestre.",
                "solicitante_externo": "Centro de Estudiantes de Informática",
                "requiere_apoyo": True,
                "auxiliares_requeridos": 1,
                "bloques": [
                    {"laboratorio": self.labs["LAB-2"], "fecha": sabado, "hora_inicio": time(8, 0), "hora_fin": time(12, 0)}
                ],
                "programas": [vs_code],
                "auxiliares": [self.usuarios["ana.rojas"]],
            },
            {
                "titulo": "Curso de Python para docentes",
                "solicitante": self.usuarios["silvia.antelo"],
                "requiere_apoyo": False,
                "bloques": [
                    {"laboratorio": self.labs["LAB-1"], "fecha": sabado, "hora_inicio": time(14, 0), "hora_fin": time(17, 0)},
                    {
                        "laboratorio": self.labs["LAB-1"],
                        "fecha": sabado + timedelta(days=7),
                        "hora_inicio": time(14, 0),
                        "hora_fin": time(17, 0),
                    },
                ],
                "programas": [python, self.software[8]],  # AutoCAD no está en LAB-1: genera advertencia
            },
        ]
        for datos in ejemplos:
            # Una reserva que choca ya no da error (queda por aprobar): se evita duplicarla así.
            if Reserva.objects.filter(titulo=datos["titulo"]).exclude(estado=EstadoReserva.CANCELADA).exists():
                continue
            try:
                planificacion.guardar_reserva(reserva=None, datos=datos, usuario=self.admin)
            except ErrorNegocio as error:
                self.stdout.write(self.style.WARNING(f"Reserva omitida: {error.mensaje}"))

    # ── Objetos perdidos ──
    def _objetos(self):
        if ObjetoPerdido.objects.exists():
            return
        auxiliar = self.usuarios["ana.rojas"]
        ahora = timezone.now()
        objetos.registrar(
            datos={
                "descripcion": "Mochila negra con cuadernos",
                "categoria": "accesorio",
                "caracteristicas": "Marca Totto, llavero rojo",
                "laboratorio": self.labs["LAB-1"],
                "lugar": "Debajo de la PC-12",
                "fecha_hallazgo": ahora - timedelta(hours=3),
                "encontrado_por": "Auxiliar de turno",
            },
            usuario=auxiliar,
        )
        carnet = objetos.registrar(
            datos={
                "descripcion": "Carnet universitario",
                "categoria": "documento",
                "laboratorio": self.labs["LAB-2"],
                "lugar": "Escritorio docente",
                "fecha_hallazgo": ahora - timedelta(days=2),
            },
            usuario=auxiliar,
        )
        objetos.entregar(
            objeto=carnet, entregado_a="Estudiante titular", entregado_ci="9876543", observacion="", usuario=self.admin
        )
        objetos.registrar(
            datos={
                "descripcion": "Cargador de laptop",
                "categoria": "electronico",
                "caracteristicas": "Lenovo, punta USB-C",
                "laboratorio": self.labs["LAB-3"],
                "fecha_hallazgo": ahora - timedelta(days=1, hours=5),
            },
            usuario=self.usuarios["carlos.mendez"],
        )

    # ── Preferencias de los docentes ──
    def _preferencias(self):
        opciones = list(OpcionPreferencia.objects.order_by("orden"))
        if len(opciones) < 4:
            return
        ejemplos = {
            "mario.justiniano": ({0: False, 1: False, 2: True}, "Llego 5 minutos antes; no borrar lo de la clase anterior."),
            "silvia.antelo": ({0: True, 1: True, 3: True}, ""),
        }
        for usuario, (valores, nota) in ejemplos.items():
            ficha = planificacion.asegurar_ficha_docente(usuario=self.usuarios[usuario])
            if ficha is None or PreferenciasDocente.objects.filter(docente=ficha).exists():
                continue
            preferencias.guardar(
                docente=ficha,
                valores={str(opciones[i].pk): v for i, v in valores.items()},
                nota=nota,
                usuario=self.usuarios[usuario],
            )

    # ── Bitácora y revisiones periódicas ──
    def _bitacora_y_revisiones(self):
        hoy = timezone.localdate()
        ana, carlos = self.usuarios["ana.rojas"], self.usuarios["carlos.mendez"]
        if not RevisionProgramada.objects.exists():
            for lab, titulo, cada, unidad, dias, responsable in [
                ("LAB-1", "Revisión de equipos", 2, "semanas", -1, ana),
                ("LAB-2", "Revisión de equipos", 2, "semanas", 3, carlos),
                ("LAB-3", "Revisión del switch y cableado", 1, "meses", 10, None),
            ]:
                RevisionProgramada.objects.create(
                    laboratorio=self.labs[lab],
                    titulo=titulo,
                    instrucciones="Encender cada equipo, probar teclado, mouse, red y proyector. Anotar fallas.",
                    cada=cada,
                    unidad=unidad,
                    proxima_fecha=hoy + timedelta(days=dias),
                    responsable=responsable,
                    creado_por=self.admin,
                )
        if not EntradaBitacora.objects.exists():
            ahora = timezone.now()
            for lab, tipo, titulo, descripcion, elementos, dias, autor in [
                ("LAB-1", "instalacion", "Instalación de Python 3.13", "Con pip y VS Code.", "PC-01 a PC-30", 6, ana),
                ("LAB-2", "incidencia", "PC-07 no enciende", "Fuente quemada; se reportó a soporte.", "PC-07", 3, carlos),
                ("LAB-2", "mantenimiento", "Cambio de fuente de la PC-07", "Quedó operativa.", "PC-07", 1, carlos),
                ("LAB-3", "revision", "Revisión de equipos", "Todo en orden.", "", 12, ana),
            ]:
                EntradaBitacora.objects.create(
                    laboratorio=self.labs[lab],
                    tipo=tipo,
                    titulo=titulo,
                    descripcion=descripcion,
                    elementos=elementos,
                    fecha=ahora - timedelta(days=dias),
                    creado_por=autor,
                    actualizado_por=autor,
                )

    # ── Pizarrón de tareas ──
    def _tareas(self):
        if Tarea.objects.exists():
            return
        ana, carlos, lucia = (self.usuarios[u] for u in ("ana.rojas", "carlos.mendez", "lucia.paz"))
        hoy = timezone.localdate()
        cable = tareas.crear_tarea(
            datos={
                "titulo": "Cambiar cable HDMI del proyector",
                "descripcion": "El del LAB-2 falla si se mueve.",
                "prioridad": "alta",
                "laboratorio": self.labs["LAB-2"],
                "fecha_limite": hoy + timedelta(days=1),
                "responsables": [carlos],
            },
            usuario=self.admin,
        )
        docker = tareas.crear_tarea(
            datos={
                "titulo": "Instalar Docker Desktop",
                "descripcion": "Para la materia de Redes II.",
                "laboratorio": self.labs["LAB-3"],
                "fecha_limite": hoy + timedelta(days=5),
                "responsables": [ana, lucia],
            },
            usuario=self.admin,
        )
        tareas.agregar_avance(tarea=docker, usuario=ana, texto="Instalado en 12 de 30 PCs.", progreso=40)
        tareas.crear_tarea(datos={"titulo": "Ordenar el depósito de cables"}, usuario=lucia)
        tareas.cambiar_estado(tarea=cable, estado="hecha", usuario=carlos, nota="Cable nuevo colocado.")
        # La revisión vencida del LAB-1 pasa al pizarrón.
        from apps.bitacora.services import revisiones_vencidas

        revisiones_vencidas()

    # ── Solicitudes de asistencia ──
    def _asistencia(self):
        if SolicitudAsistencia.objects.exists():
            return
        asistencia.solicitar(
            datos={
                "laboratorio": self.labs["LAB-1"],
                "categoria": "proyector",
                "descripcion": "El proyector no muestra imagen desde mi laptop.",
                "urgente": True,
            },
            usuario=self.usuarios["mario.justiniano"],
        )
        tomada = asistencia.solicitar(
            datos={"lugar": "Oficina de Kardex", "categoria": "red", "descripcion": "No hay internet en la oficina."},
            usuario=self.usuarios["patricia.vargas"],
        )
        asistencia.tomar(solicitud=tomada, usuario=self.usuarios["ana.rojas"])
