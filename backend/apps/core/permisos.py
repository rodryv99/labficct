"""Matriz de permisos: el único lugar donde se decide quién puede qué.

El Superadmin tiene todos los permisos. Para dar o quitar un permiso a un rol
basta con editar este diccionario; la API y los menús de la web y la app lo
leen de aquí (la web y la app lo reciben en /auth/me/).
"""

from .roles import Rol

ADMIN = Rol.ADMIN
AUXILIAR = Rol.AUXILIAR
DOCENTE = Rol.DOCENTE
ADMINISTRATIVO = Rol.ADMINISTRATIVO
TODOS = {ADMIN, AUXILIAR, DOCENTE, ADMINISTRATIVO}

MATRIZ: dict[str, set[str]] = {
    # 1. Usuarios
    "usuarios.gestionar": {ADMIN},
    "usuarios.opciones": {ADMIN, AUXILIAR},  # listas para elegir docentes o auxiliares
    # 2. Elementos (catálogo)
    "elementos.ver": TODOS,  # leer el catálogo: hace falta para dibujar cualquier grilla
    "elementos.catalogo": {ADMIN, AUXILIAR},  # ver la pantalla del catálogo
    "elementos.gestionar": {ADMIN},
    # 3. Laboratorios
    "laboratorios.ver": TODOS,
    "laboratorios.gestionar": {ADMIN},
    "laboratorios.credenciales": {ADMIN, AUXILIAR},  # ver y mostrar; crear o editar es laboratorios.gestionar
    # Marcar qué programas tiene instalados cada laboratorio y agregar programas nuevos al catálogo.
    "laboratorios.software": {ADMIN, AUXILIAR},
    "software.ver": TODOS,
    "software.gestionar": {ADMIN},  # editar o borrar programas del catálogo
    # 4. Horarios (incluye periodos y materias)
    "horarios.ver": TODOS,
    "horarios.gestionar": {ADMIN},
    # 5. Reservas
    "reservas.ver": {ADMIN, AUXILIAR, DOCENTE},
    "reservas.gestionar": {ADMIN, AUXILIAR},
    "reservas.aprobar": {ADMIN},  # reservas que chocan: se aprueban con prioridad sobre las clases
    # 6. Pizarra de actividades
    "pizarra.ver": {ADMIN, AUXILIAR},
    # 7. Objetos perdidos
    "objetos.ver": {ADMIN, AUXILIAR},
    "objetos.registrar": {ADMIN, AUXILIAR},
    "objetos.anular": {ADMIN},
    # 8. Avisos a los auxiliares para alistar o cerrar un aula (además de los automáticos)
    "avisos.enviar": {ADMIN, AUXILIAR},
    # 9. Preferencias de los docentes (estudiantes pasan o no, borrar la pizarra…)
    "preferencias.opciones": TODOS,  # leer la lista de opciones
    "preferencias.propias": {DOCENTE},  # marcar las suyas
    "preferencias.ver": {ADMIN, AUXILIAR},  # ver las de cualquier docente
    "preferencias.gestionar": {ADMIN},  # editar la lista y las de cualquier docente
    # 10. Solicitudes de asistencia a los auxiliares
    "asistencia.ver": TODOS,  # cada quien ve las suyas; quien atiende ve todas
    "asistencia.solicitar": {DOCENTE, ADMINISTRATIVO},
    "asistencia.atender": {ADMIN, AUXILIAR},
    # 11. Bitácora de laboratorio
    "bitacora.ver": {ADMIN, AUXILIAR},
    "bitacora.gestionar": {ADMIN, AUXILIAR},  # registrar, y editar o borrar las propias
    "bitacora.editar_todas": {ADMIN},
    # 12. Revisiones periódicas
    "revisiones.ver": {ADMIN, AUXILIAR},
    "revisiones.gestionar": {ADMIN},  # programarlas y cambiar su frecuencia
    "revisiones.realizar": {ADMIN, AUXILIAR},
    # 13. Pizarrón de tareas
    "tareas.ver": {ADMIN, AUXILIAR},
    "tareas.gestionar": {ADMIN, AUXILIAR},  # crear, mover y anotar avances
    "tareas.eliminar_todas": {ADMIN},  # cada quien puede borrar las que creó
}


def tiene_permiso(usuario, codigo: str) -> bool:
    if not getattr(usuario, "is_authenticated", False) or not usuario.is_active:
        return False
    if usuario.rol == Rol.SUPERADMIN:
        return True
    return usuario.rol in MATRIZ.get(codigo, set())


def permisos_de(usuario) -> list[str]:
    return sorted(codigo for codigo in MATRIZ if tiene_permiso(usuario, codigo))
