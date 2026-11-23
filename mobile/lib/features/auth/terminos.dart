// Texto de los términos y condiciones (mismo contenido que la web). Si cambias
// el fondo, subí TERMINOS_VERSION en el backend para que todos vuelvan a aceptar.

const String terminosTitulo = 'Términos y Condiciones de Uso';

const String terminosIntro =
    'Para usar el Sistema de Gestión de Laboratorios de la FICCT debes leer y aceptar '
    'estos términos. Al aceptar, confirmas que los entiendes y te comprometes a cumplirlos.';

class SeccionTerminos {
  const SeccionTerminos(this.titulo, this.cuerpo);
  final String titulo;
  final String cuerpo;
}

const List<SeccionTerminos> terminosSecciones = [
  SeccionTerminos(
    '1. Identificación del proveedor',
    'El sistema es desarrollado y mantenido por Nexora Solutions, empresa de desarrollo '
        'de software con sede en Santa Cruz de la Sierra, Bolivia, para la Facultad de '
        'Ingeniería en Ciencias de la Computación y Telecomunicaciones (FICCT) de la '
        'Universidad Autónoma Gabriel René Moreno (UAGRM).',
  ),
  SeccionTerminos(
    '2. Objeto y uso autorizado',
    'El sistema se destina a la gestión de la infraestructura, la programación de horarios '
        'y el soporte operativo de los laboratorios de la FICCT. Se te concede una '
        'autorización de uso personal, limitada a tus funciones académicas o administrativas '
        'y al rol asignado a tu cuenta. No está permitido usarlo con fines ajenos a esos '
        'propósitos.',
  ),
  SeccionTerminos(
    '3. Cuenta y responsabilidad del usuario',
    'Tu cuenta es personal e intransferible. Eres responsable de mantener la '
        'confidencialidad de tus credenciales y de toda actividad realizada con ellas. Debes '
        'informar de inmediato cualquier uso no autorizado. Te comprometes a registrar '
        'información veraz y a no intentar acceder a datos o funciones fuera de tu rol.',
  ),
  SeccionTerminos(
    '4. Propiedad intelectual',
    'El sistema es software propietario. Los derechos patrimoniales sobre el código fuente, '
        'el diseño y la documentación pertenecen a Nexora Solutions, conforme a la Ley N.º 1322 '
        'de Derecho de Autor y el Decreto Supremo N.º 24582 de Bolivia. Queda prohibida su '
        'copia, distribución, modificación o ingeniería inversa sin autorización escrita.',
  ),
  SeccionTerminos(
    '5. Protección de datos personales',
    'El sistema trata datos personales e institucionales (como tu nombre, correo, rol y '
        'registros de actividad) únicamente para su funcionamiento, aplicando medidas de '
        'autenticación, control de acceso por roles y protección de credenciales. El '
        'tratamiento se realiza con base en el artículo 56 de la Ley N.º 164 y el Decreto '
        'Supremo N.º 1793. Tu información no se divulga ni se usa para fines distintos a los '
        'previstos.',
  ),
  SeccionTerminos(
    '6. Disponibilidad y limitación de responsabilidad',
    'Procuramos mantener el servicio disponible y realizar mantenimiento y soporte, pero el '
        'sistema se ofrece “tal cual” y puede sufrir interrupciones por mantenimiento o por '
        'fallas de servicios externos de terceros ajenos a nuestro control. Dentro de lo '
        'permitido por la ley, no asumimos responsabilidad por daños derivados de esas '
        'interrupciones ni del uso indebido del sistema.',
  ),
  SeccionTerminos(
    '7. Cambios en los términos',
    'Estos términos pueden actualizarse. Cuando el cambio sea relevante, se te solicitará '
        'aceptarlos nuevamente al iniciar sesión. El uso continuado del sistema implica la '
        'aceptación de la versión vigente.',
  ),
];
