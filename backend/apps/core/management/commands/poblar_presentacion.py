"""Puebla la base con datos realistas para la presentación de la universidad.

    docker compose exec backend python manage.py poblar_presentacion

Crea usuarios (auxiliares, docentes y administrativos), fichas de docente (con y
sin cuenta), materias, periodos académicos y los horarios sacados de las fotos de
los laboratorios de la FICCT. Los horarios se cargan con DOCENTES INVENTADOS (no
los profesores reales de las fotos), tal como se pidió.

Se puede ejecutar varias veces: no duplica lo que ya existe y saltea cualquier
choque de horario sin cortar la ejecución. NO toca los laboratorios ni su grilla.

Todos los usuarios de ejemplo tienen la contraseña Ficct2026!
"""

from datetime import date, time

from django.db import transaction
from django.core.management.base import BaseCommand

from apps.core.roles import Rol
from apps.laboratorios.models import Laboratorio
from apps.planificacion.models import Docente, Horario, Materia, PeriodoAcademico
from apps.usuarios.models import Usuario

PASSWORD = "Ficct2026!"
DOMINIO = "ficct.uagrm.edu.bo"

# ── Nombres para generar usuarios con aspecto realista (cruceños/bolivianos) ──
NOMBRES = [
    "Juan", "Carlos", "Luis", "Jorge", "Mario", "Roberto", "Fernando", "Óscar",
    "Pedro", "Raúl", "Álvaro", "Marcelo", "Gonzalo", "Rodrigo", "Diego", "Javier",
    "Sergio", "Daniel", "Andrés", "Pablo", "Ana", "María", "Lucía", "Silvia",
    "Patricia", "Carla", "Gabriela", "Verónica", "Rosa", "Elena", "Sofía",
    "Daniela", "Paola", "Mónica", "Fernanda", "Valeria", "Andrea", "Natalia",
    "Claudia", "Jimena",
]
APELLIDOS = [
    "Rojas", "Méndez", "Paz", "Justiniano", "Antelo", "Saucedo", "Vargas",
    "Montaño", "Suárez", "Roca", "Cuéllar", "Ribera", "Arteaga", "Gutiérrez",
    "Flores", "Mamani", "Quispe", "Choque", "Columba", "Sandoval", "Terrazas",
    "Vaca", "Melgar", "Durán", "Peña", "Salvatierra", "Ortiz", "Córdova",
    "Ledezma", "Chávez", "Guzmán", "Camacho", "Ibáñez", "Nogales", "Parada",
    "Zambrana", "Céspedes", "Banegas", "Áñez", "Tapia",
]

# Cuántos usuarios de cada rol.
CANT_AUXILIARES = 25
CANT_DOCENTES = 30         # docentes con cuenta
CANT_ADMINISTRATIVOS = 20
CANT_DOCENTES_SIN_CUENTA = 20  # fichas de docente sin usuario ni correo

# ── Materias: sacadas de las fotos + 15 del plan FICCT ──
# Sigla sin guion, para igualar lo que ya tenés (FIS100).
MATERIAS = [
    # De las fotos
    ("RDS210", "Análisis de Circuitos I"),
    ("RDS220", "Análisis de Circuitos II"),
    ("RDS410", "Microprocesadores"),
    ("RDS511", "Gestión y Administración de Redes"),
    ("RDS512", "Redes Inalámbricas"),
    ("RDS519", "Seguridad en Redes"),
    ("INF110", "Introducción a la Informática"),
    ("INF120", "Programación I"),
    ("INF210", "Programación II"),
    ("INF220", "Estructura de Datos I"),
    ("INF221", "Ensamblador"),
    ("INF310", "Estructura de Datos II"),
    ("INF312", "Base de Datos I"),
    ("INF322", "Base de Datos II"),
    ("INF318", "Programación Lógica"),
    ("INF323", "Sistemas Operativos I"),
    ("INF329", "Compiladores"),
    ("INF342", "Sistemas de Información I"),
    ("INF412", "Sistemas de Información II"),
    ("INF413", "Sistemas Operativos II"),
    ("INF418", "Inteligencia Artificial"),
    ("INF422", "Ingeniería de Software I"),
    ("INF428", "Sistemas Expertos"),
    ("INF432", "Sistemas para el Soporte"),
    ("INF442", "Sistemas de Información Geográfica"),
    ("INF511", "Taller de Grado I"),
    ("INF513", "Tecnología Web"),
    ("INF552", "Arquitectura del Software"),
    ("ELC102", "Programación Gráfica"),
    ("ELC103", "Tópicos Avanzados de Programación"),
    ("ELC106", "Interacción Hombre-Computador"),
    ("ELC201", "Diseño de Circuitos"),
    ("MAT101", "Cálculo I"),
    ("ROB102", "Dibujo Mecánico"),
    # 15 adicionales del plan de la carrera
    ("MAT102", "Cálculo II"),
    ("MAT103", "Álgebra Lineal"),
    ("MAT205", "Ecuaciones Diferenciales"),
    ("MAT207", "Probabilidad y Estadística I"),
    ("FIS102", "Física II"),
    ("INF119", "Estructuras Discretas"),
    ("INF211", "Programación Orientada a Objetos"),
    ("INF433", "Redes I"),
    ("INF423", "Redes II"),
    ("INF512", "Taller de Grado II"),
    ("INF521", "Sistemas Distribuidos"),
    ("INF524", "Minería de Datos"),
    ("INF530", "Seguridad Informática"),
    ("ADM100", "Administración"),
    ("LIN100", "Inglés Técnico"),
]

# ── Horarios por código de laboratorio ──
# Cada clase: (día, hora_inicio, hora_fin, sigla, grupo).
# Días: 1=Lun 2=Mar 3=Mié 4=Jue 5=Vie 6=Sáb.
# Transcritos de las fotos; el docente se asigna luego (rotando los inventados).
HORARIOS = {
    "236-43": [
        (1, "07:00", "08:30", "RDS210", "SB"),
        (1, "16:45", "18:15", "INF110", "SS"),
        (2, "07:00", "08:30", "INF220", "SA"),
        (2, "18:15", "20:30", "INF442", "SA"),
        (3, "07:00", "08:30", "INF342", "SC"),
        (4, "07:00", "08:30", "RDS210", "SA"),
        (4, "18:15", "20:30", "ELC103", "SA"),
        (5, "10:00", "11:30", "INF110", "SY"),
        (5, "18:15", "20:30", "INF442", "SA"),
    ],
    "236-44": [
        (1, "07:00", "08:30", "INF120", "SA"),
        (1, "08:30", "09:15", "INF513", "SA"),
        (1, "09:15", "10:45", "INF120", "SF"),
        (1, "16:45", "18:15", "INF120", "SD"),
        (2, "07:00", "09:15", "INF513", "SC"),
        (2, "09:15", "10:45", "RDS519", "SA"),
        (3, "07:00", "08:30", "INF120", "SA"),
        (3, "08:30", "09:15", "INF513", "SA"),
        (3, "09:15", "10:45", "INF120", "SF"),
        (3, "16:45", "18:15", "INF120", "SD"),
        (4, "07:00", "09:15", "INF513", "SC"),
        (4, "09:15", "10:45", "RDS519", "SA"),
        (4, "18:15", "20:30", "INF210", "SD"),
        (5, "07:00", "08:30", "INF120", "SA"),
        (5, "08:30", "09:15", "INF513", "SA"),
        (5, "09:15", "10:45", "INF120", "SF"),
        (5, "16:45", "18:15", "INF120", "SD"),
    ],
    "236-45": [
        (1, "07:00", "08:30", "INF342", "SC"),
        (1, "09:15", "10:45", "INF110", "SB"),
        (2, "07:00", "08:30", "INF312", "SC"),
        (2, "08:30", "10:45", "INF110", "SI"),
        (2, "11:30", "13:00", "INF329", "SA"),
        (2, "15:15", "16:45", "INF110", "Z3"),
        (2, "16:45", "18:15", "INF120", "SD"),
        (2, "18:15", "19:45", "INF210", "SD"),
        (2, "20:30", "22:45", "INF310", "SX"),
        (3, "08:30", "10:00", "INF110", "SF"),
        (3, "10:00", "10:45", "INF110", "Z2"),
        (3, "11:30", "13:00", "INF329", "SA"),
        (3, "16:45", "18:15", "INF120", "SH"),
        (3, "18:15", "19:45", "INF318", "SA"),
        (3, "19:45", "21:15", "ELC106", "SA"),
        (4, "07:00", "08:30", "INF412", "SA"),
        (4, "08:30", "10:45", "INF110", "SI"),
        (5, "07:00", "08:30", "INF323", "SA"),
        (5, "08:30", "10:00", "INF110", "SF"),
        (5, "10:00", "10:45", "INF428", "SB"),
        (5, "11:30", "13:00", "INF329", "SA"),
        (5, "13:45", "14:30", "INF110", "Z4"),
        (5, "18:15", "19:45", "INF432", "SA"),
        (5, "19:45", "21:15", "INF120", "SG"),
        (6, "07:00", "08:30", "ELC102", "SA"),
    ],
    "236-46": [
        (1, "07:00", "08:30", "INF552", "SA"),
        (1, "10:00", "10:45", "INF110", "Z2"),
        (1, "16:45", "18:15", "INF120", "SD"),
        (1, "19:45", "21:15", "INF221", "SX"),
        (2, "08:30", "10:45", "INF110", "Z6"),
        (2, "16:00", "17:30", "INF413", "SB"),
        (2, "18:15", "19:45", "INF418", "SA"),
        (2, "19:45", "21:15", "ELC106", "SA"),
        (3, "07:00", "08:30", "INF110", "Z1"),
        (3, "10:00", "10:45", "INF428", "SB"),
        (3, "16:45", "18:15", "INF120", "SC"),
        (4, "07:00", "07:45", "INF210", "SC"),
        (4, "07:45", "09:15", "INF210", "SB"),
        (4, "13:45", "15:15", "INF210", "SA"),
        (4, "18:15", "19:45", "INF418", "SA"),
        (4, "21:15", "22:45", "INF310", "SX"),
        (5, "07:00", "08:30", "INF552", "SA"),
        (5, "08:30", "09:15", "INF323", "SC"),
        (5, "10:45", "11:30", "INF322", "SB"),
        (5, "16:45", "18:15", "INF120", "SC"),
        (5, "18:15", "19:45", "INF110", "Z5"),
    ],
    "236-42": [
        (1, "15:15", "16:45", "INF422", "SB"),
        (1, "16:45", "18:15", "INF412", "SB"),
        (1, "18:15", "19:45", "INF422", "SB"),
        (1, "20:30", "22:00", "INF511", "SA"),
        (2, "15:15", "16:45", "INF422", "SC"),
        (2, "18:15", "19:45", "INF422", "SB"),
        (2, "20:30", "22:00", "INF511", "SA"),
        (3, "15:15", "16:45", "INF422", "SB"),
        (3, "16:45", "18:15", "INF412", "SB"),
        (4, "15:15", "16:45", "INF422", "SC"),
        (4, "18:15", "19:45", "INF422", "SB"),
        (4, "20:30", "22:00", "INF511", "SA"),
        (5, "15:15", "16:45", "INF422", "SB"),
        (5, "16:45", "18:15", "INF412", "SB"),
    ],
    "236-41": [
        (1, "07:00", "07:45", "INF221", "SA"),
        (1, "07:45", "09:15", "INF312", "SA"),
        (1, "10:00", "11:30", "INF428", "SB"),
        (1, "11:30", "13:00", "INF220", "SD"),
        (1, "18:15", "19:45", "INF110", "SN"),
        (1, "20:30", "22:45", "INF220", "SB"),
        (2, "07:00", "08:30", "INF120", "SB"),
        (2, "08:30", "10:00", "INF342", "SA"),
        (2, "13:00", "14:30", "ROB102", "W1"),
        (2, "16:00", "17:30", "INF413", "SB"),
        (2, "18:15", "19:45", "INF432", "SA"),
        (3, "09:15", "10:45", "INF221", "SC"),
        (3, "13:00", "14:30", "ROB102", "W1"),
        (3, "18:15", "19:00", "INF432", "SA"),
        (4, "07:00", "08:30", "INF221", "SB"),
        (4, "09:15", "10:00", "MAT101", "22"),
        (4, "16:00", "17:30", "INF413", "SB"),
        (4, "18:15", "19:45", "INF322", "SD"),
        (5, "07:00", "07:45", "INF110", "SZ"),
        (5, "08:30", "09:15", "RDS220", "SZ"),
        (5, "10:00", "10:45", "INF221", "SC"),
    ],
    "236-36": [  # Laboratorio de electrónica
        (1, "18:15", "19:45", "RDS511", "SA"),
        (2, "16:00", "17:30", "RDS410", "SA"),
        (3, "18:15", "19:45", "RDS511", "SA"),
        (4, "07:00", "08:00", "ELC201", "SA"),
        (4, "16:00", "17:30", "RDS410", "SA"),
        (5, "18:15", "19:45", "RDS511", "SA"),
    ],
    "123-3": [  # Laboratorio de redes
        (1, "07:00", "09:15", "INF423", "R1"),
        (3, "07:00", "09:15", "INF423", "R1"),
        (5, "07:00", "09:15", "INF423", "R1"),
    ],
    # 232-09 y 236-38 NO existen en la base: sus clases (INF310 y RDS512) se omiten.
}


def _slug(texto: str) -> str:
    """Pasa a minúsculas sin tildes ni eñes, para armar correos."""
    reemplazos = str.maketrans("áéíóúüñ", "aeiouun")
    return texto.lower().translate(reemplazos)


def _hora(texto: str) -> time:
    h, m = texto.split(":")
    return time(int(h), int(m))


class Command(BaseCommand):
    help = "Puebla usuarios, docentes, materias, periodos y horarios para la presentación."

    def handle(self, *args, **options):
        self.admin = Usuario.objects.filter(is_superuser=True).order_by("pk").first()
        if self.admin is None:
            self.admin = Usuario.objects.filter(rol=Rol.ADMIN).order_by("pk").first()

        auxiliares = self._usuarios(CANT_AUXILIARES, Rol.AUXILIAR, "aux", "211")
        docentes_usuarios = self._usuarios(CANT_DOCENTES, Rol.DOCENTE, "doc", "212")
        self._usuarios(CANT_ADMINISTRATIVOS, Rol.ADMINISTRATIVO, "adm", "213")

        docentes = self._docentes(docentes_usuarios)
        self._materias()
        periodo = self._periodos()
        self._horarios(periodo, docentes)

        self.stdout.write(self.style.SUCCESS("Datos de la presentación listos."))
        self.stdout.write(f"Contraseña de todos los usuarios de ejemplo: {PASSWORD}")

    # ── Usuarios ──
    def _usuarios(self, cantidad, rol, prefijo, serie):
        creados = []
        for i in range(cantidad):
            nombres = NOMBRES[i % len(NOMBRES)]
            apellidos = f"{APELLIDOS[i % len(APELLIDOS)]} {APELLIDOS[(i + 13) % len(APELLIDOS)]}"
            email = f"{prefijo}.{_slug(NOMBRES[i % len(NOMBRES)])}.{_slug(APELLIDOS[i % len(APELLIDOS)])}{i}@{DOMINIO}"
            usuario, creado = Usuario.objects.get_or_create(
                email=email,
                defaults={
                    "nombres": nombres,
                    "apellidos": apellidos,
                    "rol": rol,
                    "codigo": f"{serie}{i:04d}",
                    "telefono": f"7{serie[-1]}{i:06d}"[:8],
                },
            )
            if creado:
                usuario.set_password(PASSWORD)
                usuario.save(update_fields=["password"])
            creados.append(usuario)
        self.stdout.write(f"{rol}: {len(creados)} usuarios.")
        return creados

    # ── Fichas de docente ──
    def _docentes(self, docentes_usuarios):
        """Una ficha por cada usuario docente + 20 fichas sin cuenta ni correo."""
        fichas = []
        for usuario in docentes_usuarios:
            ficha, _ = Docente.objects.get_or_create(
                usuario=usuario,
                defaults={
                    "nombres": usuario.nombres,
                    "apellidos": usuario.apellidos,
                    "email": usuario.email,
                    "creado_por": self.admin,
                },
            )
            fichas.append(ficha)

        base = len(NOMBRES) // 2  # arranca en otra parte de la lista para variar
        for i in range(CANT_DOCENTES_SIN_CUENTA):
            nombres = NOMBRES[(base + i) % len(NOMBRES)]
            apellidos = f"{APELLIDOS[(base + i) % len(APELLIDOS)]} {APELLIDOS[(base + i + 5) % len(APELLIDOS)]}"
            # Sin correo: se identifica por nombre para no duplicar al reejecutar.
            ficha = Docente.objects.filter(
                usuario__isnull=True, nombres=nombres, apellidos=apellidos
            ).first()
            if ficha is None:
                ficha = Docente.objects.create(
                    nombres=nombres, apellidos=apellidos, email="", creado_por=self.admin
                )
            fichas.append(ficha)

        self.stdout.write(f"Docentes (fichas): {len(fichas)} ({CANT_DOCENTES} con cuenta, {CANT_DOCENTES_SIN_CUENTA} sin cuenta).")
        return fichas

    # ── Materias ──
    def _materias(self):
        creadas = 0
        for sigla, nombre in MATERIAS:
            _, creado = Materia.objects.get_or_create(
                sigla=sigla, defaults={"nombre": nombre, "creado_por": self.admin}
            )
            creadas += int(creado)
        self.stdout.write(f"Materias nuevas: {creadas} (de {len(MATERIAS)}).")

    # ── Periodos ──
    def _periodos(self):
        # El vigente (2-2026) ya existe: lo usamos para los horarios.
        vigente = PeriodoAcademico.objects.filter(nombre="2-2026").first()
        if vigente is None:
            vigente, _ = PeriodoAcademico.objects.get_or_create(
                nombre="2-2026",
                defaults={
                    "fecha_inicio": date(2026, 9, 25),
                    "fecha_fin": date(2026, 12, 18),
                    "vigente": True,
                    "creado_por": self.admin,
                },
            )
        # Dos periodos pasados.
        PeriodoAcademico.objects.get_or_create(
            nombre="1-2026",
            defaults={
                "fecha_inicio": date(2026, 2, 2),
                "fecha_fin": date(2026, 6, 26),
                "vigente": False,
                "creado_por": self.admin,
            },
        )
        PeriodoAcademico.objects.get_or_create(
            nombre="2-2025",
            defaults={
                "fecha_inicio": date(2025, 8, 4),
                "fecha_fin": date(2025, 12, 12),
                "vigente": False,
                "creado_por": self.admin,
            },
        )
        return vigente

    # ── Horarios ──
    def _horarios(self, periodo, docentes):
        labs = {lab.codigo: lab for lab in Laboratorio.objects.all()}
        total, saltados, faltan = 0, 0, 0
        rot = 0
        for codigo, clases in HORARIOS.items():
            lab = labs.get(codigo)
            if lab is None:
                faltan += len(clases)
                continue
            for dia, ini, fin, sigla, grupo in clases:
                materia = Materia.objects.filter(sigla=sigla).first()
                if materia is None:
                    continue
                docente = docentes[rot % len(docentes)]
                rot += 1
                hora_inicio = _hora(ini)
                # Ya existe uno igual: no duplicar.
                if Horario.objects.filter(
                    periodo=periodo, laboratorio=lab, dia_semana=dia,
                    hora_inicio=hora_inicio, materia=materia, grupo=grupo,
                ).exists():
                    continue
                try:
                    # Savepoint propio: si choca con otra clase (restricción de
                    # exclusión de PostgreSQL), se saltea sin abortar el resto.
                    with transaction.atomic():
                        Horario.objects.create(
                            periodo=periodo,
                            laboratorio=lab,
                            materia=materia,
                            grupo=grupo,
                            docente=docente,
                            dia_semana=dia,
                            hora_inicio=hora_inicio,
                            hora_fin=_hora(fin),
                            creado_por=self.admin,
                        )
                    total += 1
                except Exception as error:  # IntegrityError por choque de franja
                    saltados += 1
                    self.stdout.write(self.style.WARNING(
                        f"  {codigo} {sigla}-{grupo} día {dia} {ini}: saltado ({type(error).__name__})"
                    ))
        self.stdout.write(f"Horarios creados: {total}. Saltados por choque: {saltados}. "
                          f"En labs inexistentes (232-09/236-38): {faltan}.")
